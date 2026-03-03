#!/usr/bin/swift
// ═══════════════════════════════════════════
// OUMNIA OS — Native macOS Speech Recognition
// Uses SFSpeechRecognizer (Apple on-device STT)
// Outputs JSON lines to stdout, reads commands from stdin
// ═══════════════════════════════════════════

import Speech
import AVFoundation
import Foundation

class SpeechEngine: NSObject, SFSpeechRecognizerDelegate {
    let recognizer: SFSpeechRecognizer
    let audioEngine = AVAudioEngine()
    var recognitionTask: SFSpeechRecognitionTask?
    var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    var silenceTimer: Timer?
    var restartTimer: Timer?
    var lastTranscript = ""
    var isActive = false  // True when we're supposed to be listening
    var isTransitioning = false  // True during start/stop transitions

    override init() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "fr-FR"))!
        super.init()
        recognizer.delegate = self
    }

    func output(_ dict: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: dict),
           let str = String(data: data, encoding: .utf8) {
            print(str)
            fflush(stdout)
        }
    }

    func requestPermissions(completion: @escaping (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            if status != .authorized {
                self.output(["error": "speech_not_authorized", "status": "\(status.rawValue)"])
                completion(false)
                return
            }
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                if !granted {
                    self.output(["error": "mic_not_authorized"])
                }
                completion(granted)
            }
        }
    }

    func startListening() {
        // Prevent re-entrance during transitions
        if isTransitioning {
            output(["debug": "skipped_start_transitioning"])
            return
        }
        // Don't restart if already active
        if recognitionTask != nil {
            output(["debug": "skipped_start_already_active"])
            return
        }

        isTransitioning = true
        isActive = true

        output(["debug": "start_begin"])

        // Clean up without triggering restart
        cleanupAudio()

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let request = recognitionRequest else {
            output(["error": "cannot_create_request"])
            isTransitioning = false
            return
        }

        request.shouldReportPartialResults = true

        // Check on-device support and use it if available
        if #available(macOS 13, *) {
            if recognizer.supportsOnDeviceRecognition {
                request.requiresOnDeviceRecognition = true
                output(["debug": "using_on_device"])
            } else {
                output(["debug": "on_device_not_supported_using_network"])
            }
        }

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        output(["debug": "audio_format", "sampleRate": recordingFormat.sampleRate, "channels": Int(recordingFormat.channelCount)])

        audioEngine.prepare()

        inputNode.installTap(onBus: 0, bufferSize: 4096, format: recordingFormat) { buffer, _ in
            request.append(buffer)
        }

        do {
            try audioEngine.start()
        } catch {
            output(["error": "audio_engine_failed", "message": error.localizedDescription])
            cleanupAudio()
            isTransitioning = false
            scheduleRestart(delay: 3.0)
            return
        }

        output(["status": "listening"])

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                let text = result.bestTranscription.formattedString
                let isFinal = result.isFinal

                // Reset silence timer
                self.silenceTimer?.invalidate()
                self.silenceTimer = nil

                self.output([
                    "text": text,
                    "final": isFinal
                ])

                if isFinal {
                    self.lastTranscript = ""
                    // Schedule restart for continuous listening
                    self.scheduleRestart(delay: 1.0)
                } else {
                    self.lastTranscript = text
                    // Auto-finalize after 4s of silence (longer = fewer mid-phrase cuts)
                    self.silenceTimer = Timer.scheduledTimer(withTimeInterval: 4.0, repeats: false) { _ in
                        if !text.isEmpty {
                            self.output(["text": text, "final": true, "auto_final": true])
                            self.lastTranscript = ""
                            self.scheduleRestart(delay: 1.0)
                        }
                    }
                }
            }

            if let error = error as NSError? {
                let code = error.code
                let domain = error.domain

                // Log ALL errors for diagnosis
                self.output(["debug": "recognition_error", "code": code, "domain": domain, "message": error.localizedDescription])

                // Don't restart if we've been told to stop
                guard self.isActive else { return }

                if code == 216 || code == 1110 {
                    // Normal timeout / no speech — restart after delay
                    self.scheduleRestart(delay: 2.0)
                } else if code == 301 || code == 209 {
                    // 301 = recognition cancelled (by us), 209 = retry
                    // Don't restart — we cancelled it intentionally
                    return
                } else {
                    // Unknown error — longer delay
                    self.output(["error": "recognition_error", "code": code, "message": error.localizedDescription])
                    self.scheduleRestart(delay: 5.0)
                }
            }
        }

        output(["debug": "task_created"])
        isTransitioning = false
    }

    func scheduleRestart(delay: Double) {
        // Cancel any pending restart
        restartTimer?.invalidate()
        restartTimer = nil

        guard isActive else { return }

        restartTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            self.restartTimer = nil
            guard self.isActive else { return }
            self.output(["debug": "scheduled_restart"])
            self.cleanupAudio()
            self.recognitionTask = nil
            // Small delay to let cleanup complete
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                if self.isActive {
                    self.startListening()
                }
            }
        }
    }

    func cleanupAudio() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        recognitionTask?.cancel()
        recognitionRequest?.endAudio()
        recognitionRequest = nil

        audioEngine.inputNode.removeTap(onBus: 0)
        if audioEngine.isRunning {
            audioEngine.stop()
        }
    }

    func stopListening() {
        isActive = false
        restartTimer?.invalidate()
        restartTimer = nil
        cleanupAudio()
        recognitionTask = nil
    }

    func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer, availabilityDidChange available: Bool) {
        output(["status": available ? "available" : "unavailable"])
        // Only auto-start if we should be active but have no task
        if available && isActive && recognitionTask == nil && !isTransitioning {
            output(["debug": "availability_triggered_start"])
            startListening()
        }
    }
}

// ═══ MAIN ═══
let engine = SpeechEngine()

// Log capabilities
if #available(macOS 13, *) {
    engine.output(["debug": "on_device_supported", "value": engine.recognizer.supportsOnDeviceRecognition])
}
engine.output(["debug": "recognizer_available", "value": engine.recognizer.isAvailable])

engine.requestPermissions { granted in
    if granted {
        engine.output(["status": "ready"])
        DispatchQueue.main.async {
            // Only start if not already started by availabilityDidChange
            if engine.recognitionTask == nil && !engine.isTransitioning {
                engine.startListening()
            }
        }
    } else {
        engine.output(["status": "no_permission"])
    }
}

// Read stdin for commands (stop, start, quit)
DispatchQueue.global().async {
    while let line = readLine() {
        let cmd = line.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        DispatchQueue.main.async {
            switch cmd {
            case "stop":
                engine.stopListening()
                engine.output(["status": "stopped"])
            case "start":
                if engine.recognitionTask == nil {
                    engine.startListening()
                }
            case "quit":
                engine.stopListening()
                exit(0)
            default:
                break
            }
        }
    }
}

RunLoop.main.run()
