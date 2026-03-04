#!/usr/bin/swift
// ═══════════════════════════════════════════
// OUMNIA OS — Native macOS Speech Recognition
// Uses SFSpeechRecognizer (Apple on-device STT)
// Supports: fr-FR, ar-SA, en-US (switchable via stdin)
// Outputs JSON lines to stdout, reads commands from stdin
// ═══════════════════════════════════════════

import Speech
import AVFoundation
import Foundation

class SpeechEngine: NSObject, SFSpeechRecognizerDelegate {
    var recognizer: SFSpeechRecognizer
    var currentLocale: String = "fr-FR"
    let audioEngine = AVAudioEngine()
    var recognitionTask: SFSpeechRecognitionTask?
    var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    var silenceTimer: Timer?
    var restartTimer: Timer?
    var lastTranscript = ""
    var isActive = false
    var isTransitioning = false

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

    // ═══ LANGUAGE SWITCH ═══
    func switchLanguage(_ locale: String) {
        let wasActive = isActive
        if wasActive {
            stopListening()
        }

        guard let newRecognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)) else {
            output(["error": "unsupported_locale", "locale": locale])
            return
        }

        currentLocale = locale
        recognizer = newRecognizer
        recognizer.delegate = self

        output(["status": "language_changed", "locale": locale])

        if wasActive {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self.startListening()
            }
        }
    }

    func startListening() {
        if isTransitioning {
            output(["debug": "skipped_start_transitioning"])
            return
        }
        if recognitionTask != nil {
            output(["debug": "skipped_start_already_active"])
            return
        }

        isTransitioning = true
        isActive = true

        cleanupAudio()

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let request = recognitionRequest else {
            output(["error": "cannot_create_request"])
            isTransitioning = false
            return
        }

        request.shouldReportPartialResults = true

        if #available(macOS 13, *) {
            if recognizer.supportsOnDeviceRecognition {
                request.requiresOnDeviceRecognition = true
                output(["debug": "using_on_device", "locale": currentLocale])
            } else {
                output(["debug": "using_network", "locale": currentLocale])
            }
        }

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

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

        output(["status": "listening", "locale": currentLocale])

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                let text = result.bestTranscription.formattedString
                let isFinal = result.isFinal

                self.silenceTimer?.invalidate()
                self.silenceTimer = nil

                self.output([
                    "text": text,
                    "final": isFinal,
                    "locale": self.currentLocale
                ])

                if isFinal {
                    self.lastTranscript = ""
                    self.scheduleRestart(delay: 1.0)
                } else {
                    self.lastTranscript = text
                    self.silenceTimer = Timer.scheduledTimer(withTimeInterval: 4.0, repeats: false) { _ in
                        if !text.isEmpty {
                            self.output(["text": text, "final": true, "auto_final": true, "locale": self.currentLocale])
                            self.lastTranscript = ""
                            self.scheduleRestart(delay: 1.0)
                        }
                    }
                }
            }

            if let error = error as NSError? {
                let code = error.code
                let domain = error.domain

                self.output(["debug": "recognition_error", "code": code, "domain": domain, "message": error.localizedDescription])

                guard self.isActive else { return }

                if code == 216 || code == 1110 {
                    self.scheduleRestart(delay: 2.0)
                } else if code == 301 || code == 209 {
                    return
                } else {
                    self.output(["error": "recognition_error", "code": code, "message": error.localizedDescription])
                    self.scheduleRestart(delay: 5.0)
                }
            }
        }

        isTransitioning = false
    }

    func scheduleRestart(delay: Double) {
        restartTimer?.invalidate()
        restartTimer = nil

        guard isActive else { return }

        restartTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            self.restartTimer = nil
            guard self.isActive else { return }
            self.cleanupAudio()
            self.recognitionTask = nil
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
        if available && isActive && recognitionTask == nil && !isTransitioning {
            startListening()
        }
    }
}

// ═══ MAIN ═══
let engine = SpeechEngine()

if #available(macOS 13, *) {
    engine.output(["debug": "on_device_supported", "value": engine.recognizer.supportsOnDeviceRecognition])
}
engine.output(["debug": "recognizer_available", "value": engine.recognizer.isAvailable])
engine.output(["debug": "supported_locales", "locales": "fr-FR,ar-SA,en-US"])

engine.requestPermissions { granted in
    if granted {
        engine.output(["status": "ready"])
        DispatchQueue.main.async {
            if engine.recognitionTask == nil && !engine.isTransitioning {
                engine.startListening()
            }
        }
    } else {
        engine.output(["status": "no_permission"])
    }
}

// Read stdin for commands
DispatchQueue.global().async {
    while let line = readLine() {
        let cmd = line.trimmingCharacters(in: .whitespacesAndNewlines)
        let cmdLower = cmd.lowercased()
        DispatchQueue.main.async {
            if cmdLower.hasPrefix("lang:") {
                let locale = String(cmd.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                engine.switchLanguage(locale)
            } else {
                switch cmdLower {
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
}

RunLoop.main.run()
