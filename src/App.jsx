import { useEffect, useRef, useState } from "react";
import "./App.css";
function App() {
  const videoRef = useRef(null);

  // 🔒 Backend-only lock
  const backendLockRef = useRef(false);

  const [status, setStatus] = useState("🟢 Detecting faces");
  const [serverResponse, setServerResponse] = useState(null);

  useEffect(() => {
    if (!window.FaceDetection || !window.Camera) {
      console.error("MediaPipe not loaded");
      return;
    }

    const faceDetection = new window.FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });

    faceDetection.setOptions({
      model: "short",
      minDetectionConfidence: 0.9,
    });

    faceDetection.onResults(async (results) => {
      if (!results.detections || results.detections.length === 0) return;

      if (backendLockRef.current) return;

      backendLockRef.current = true;
      setStatus("⏳ Sending frame to backend...");

      await sendFrameToBackend();
    });

    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        await faceDetection.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });

    camera.start();

    return () => camera.stop();
  }, []);

  // 🔹 Send frame to backend & receive response
  const sendFrameToBackend = async () => {
    const video = videoRef.current;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise((resolve) =>
      tempCanvas.toBlob(resolve, "image/jpeg")
    );

    const formData = new FormData();
    formData.append("image", blob);

    try {
      const res = await fetch("https://ruthfully-tendinous-tula.ngrok-free.dev/recognize", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log("Backend response:", data);

      // Save full response
      setServerResponse(data);
      setStatus("✅ Backend processed frame");
    } catch (err) {
      console.error("❌ Backend error:", err);
      setServerResponse({ name: "Error", similarity: "-" });
      setStatus("❌ Backend error");
    }

    // ⏳ Cooldown: 5 seconds
    setTimeout(() => {
      backendLockRef.current = false;
      setStatus("🟢 Detecting faces");
    }, 500);
  };

  return (
    <div className="boxer">
    <div style={{ textAlign: "center" }}>
      <h3>Face Recognition</h3>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        width={640}
        height={480}
        style={{ border: "2px solid black" }}
      />

      <p>
        <strong>Status:</strong> {status}
      </p>

      {/*Backend response printed here */}
      {serverResponse && (
        <div style={{ marginTop: "12px" }}>
          <p>
            <strong>Roll Number:</strong>{" "}
            <span
              style={{
                color:
                  serverResponse.name === "Unknown" ? "red" : "green",
                fontWeight: "bold",
              }}
            >
              {serverResponse.name}
            </span>
          </p>

          <p>
            <strong>Similarity:</strong>{" "}
            <span style={{ color: "blue" }}>
              {serverResponse.similarity}
            </span>
          </p>
        </div>
      )}
    </div>
  </div>
  );
}

export default App;
