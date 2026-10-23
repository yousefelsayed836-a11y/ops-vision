# Local video analysis — first measured slice

The site accepts authenticated MP4 uploads, queues durable jobs, runs a separate local Python/OpenCV worker, stores immutable raw results, serves private evidence/video with byte ranges, and stores append-only human reviews. `video.analyze` is required; tenant and branch scope apply to every endpoint. Platform administration alone grants no tenant video access. Review labels are human annotations, never model predictions or training claims.

## Setup

Apply migrations through 007 and generate Prisma. Install Python 3.11+ and dependencies using `python -m pip install --target .data/python -r workers/video_analysis/requirements.txt`. The local tested runtime uses Python 3.13, numpy 2.2.6 and OpenCV 4.12.0.88. `.data/python` is isolated from the application's other runtimes.

Download the official YOLOX-S ONNX model to `.data/models/yolox_s.onnx`:

- [Official YOLOX project](https://github.com/Megvii-BaseDetection/YOLOX) (Apache 2.0 project).
- [Official model release](https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_s.onnx).
- Tested file SHA256: `c5c2d13e59ae883e6af3b45daea64af4833a4951c92d116ec270d9ddbe998063`.
- [Official ONNX preprocessing/postprocessing](https://github.com/Megvii-BaseDetection/YOLOX/tree/main/demo/ONNXRuntime).
- [OpenCV DNN YOLO documentation](https://docs.opencv.org/5.0/tutorials/dnn/dnn_yolo/dnn_yolo.html).

Set `OPSVISION_PYTHON` to the Python executable if needed. Run `npm run video:worker` separately from Next and the rules worker. `npm run video:worker -- --once` processes one job. Run `npm run worker` for subsequent automation actions. Workers require the same private `.data/video-analysis` storage and database as the web process. Model, dependencies, uploaded videos and credentials are excluded from source archives.

## What is measured

CPU YOLOX-S COCO detections for car/motorcycle/bus/truck, sampled at approximately four frames per second. Greedy spatial/appearance tracking, scene-cut separation, first/last observed time, confidence, evidence images and optional bottom-center rectangular-area intervals. Strong spatial continuity tolerates color changes under spray/shadows. Tracks with fewer than three observations are excluded. Appearance span is not continuous service time; area intervals are not wash-completion events.

Raw `confirmedWashedCount` remains zero because this model does not establish completed washes. The site independently calculates **reviewer-confirmed** counts from latest human annotations. It does not create operational washes, vehicles, receipts or payments from these observations. A `video.analysis_completed` event with source `VIDEO_FILE` is emitted transactionally once per job using the job ID as deduplication key.

## Limits and next development

- COCO detection does not classify sedan/CUV/SUV, wash service, physical vehicle dimensions or drivetrain. Those fields remain UNKNOWN until human review. 4×4 cannot be proven by body shape.
- Moving cameras, occlusion and similar vehicles can split/merge identities. Track count is not unique car count. No accuracy percentage can be estimated from one unlabeled clip.
- A complete wash duration requires visible service start/end and a calibrated definition of the wash area/action, or an operational system signal. Clip-boundary observations are marked incomplete.
- The current site/camera IP fields and upload associations are metadata. RTSP/ONVIF acquisition, gateway networking, live camera health and continuous recording have not been implemented or tested.
- Additional representative full-cycle fixed-camera clips and reviewed labels are needed to evaluate tracking and train/validate fine categories and wash activity. Uploading examples does not automatically retrain the model.
- Maximum 48 MiB, 15 minutes, 4096-pixel dimensions, six samples/sec, ten-minute analysis runtime. Three pending jobs and 100 stored videos per tenant. Local disk only; deletion/retention, malware scanning, isolated decoder containers, scheduling fairness, GPU scale and supervised production deployment remain pending. Long clips may hit CPU runtime limits.

## Initial vfx.mp4 test

The supplied `.crdownload` finished as `Downloads/vfx.mp4`. Copied unchanged and processed locally; no external inference or video upload. Duration 19.2 s, 720×1280, 30 fps, 576 frames; 72 analyzed frames at 3.75 fps. Foreground visual reference: white high-bodied vehicle, blue hatchback and two queue vehicles. Two foreground passages at a spray arch are visible, without complete wash cycles. A color-gated experiment split the blue vehicle and produced five tracks; spatial continuity was adjusted and regression-tested rather than converting that extra track into a wash.

Detailed measured output and comparison artifacts are outside source in `../video-analysis-vfx/`. This clip alone cannot establish the requested full wash counts/types/durations.


Final spatial-continuity rerun:4 tracks, runtime81.92s, source19.2s. Blue track5.333–15.467s; white0–7.2s; queue tracks16–18.933s and17.067–18.933s. Still no full-cycle wash confirmation. Result persisted through real HTTP upload and worker.6 Python regression tests and private-access HTTP checks passed.


2026-10-19 FINAL measured video result: complete cold pass finished315.44s, source966s,193frames at0.199703fps,7raw tracks; zone-summary0entries/0exits/0complete passages/2partial visits. Main zone tracksV0027.233–195.45 andV004211.05–961.233; visually same primary white SUV fragmented by tracking gap, NOT2confirmed vehicles or washes. Other5raw tracks outside selected zone are hidden by default behind explicit show-outside checkbox. Raw model fine-category/service/duration remainUNKNOWN; visible exterior washing is a human visual observation only. Imported into authorized demo org/bay1 via scripts/import-analyzed-video.ts, job22eabc7f-a0a5-449f-9565-43882374619a, source/evidence private and normal completion event audited; no operational washes/payments created. Actual9recording HTTP checks PASS (owner/private ranges/worker and unauth denials), plus19generalHTTP PASS after restart under network grant.62integration/19unit/13Python/lint/typecheck/build PASS before final small show-outside toggle; final lint/typecheck outcome below. Browser verified owner wash form no size and local file preview, rotation270, frame150s, actual drag region; screenshot ../opsvision-ai-zone-preview.jpg. Actual report displayed in UI with branch/bay and correct partial times. Fresh reload needed after translation HMR; do not ignore missing-message overlay if present. Worker75403 running continuously in current execution context, dev73215 and DB12635; supervision/persistence beyond tool context not claimed. New runtime .data/vision-runtime-current installed successfully after setting TEMP/TMP .data/tmp-vision; no ACL changes. Initial .5fps interrupted run had no report; actual finished pass is .2fps and limitations documented. Arabic result ../video-analysis-whatsapp/نتيجة-التجربة.md. Live camera ingestion, reliable fine-body/wash-service classifier and full-cycle accuracy validation remain pending; not a complete autonomous AI system.


Final UI/verification: strict typecheck and lint PASS after show-outside toggle. Browser reload resolved stale translation HMR; report shows2in-bay fragments,0reviewer-confirmed washes,966seconds,0observed entry/exit, no issue overlay. Actual local file chooser/rotation270/frame150s/drag-selection verified; no duplicate analysis submitted from UI. Screenshots ../opsvision-ai-zone-preview.jpg and ../opsvision-ai-report.jpg. Complete report source/evidence served privately;9specific recording HTTP checks PASS. User-facing size choices absent in tested owner wash and video review, removed in all form sources. No automatic fine-category, commercial wash-service, full-cycle timing or live-camera claim.
