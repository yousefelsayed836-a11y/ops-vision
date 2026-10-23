// The requested simplified operations UI replaces video/rules/simulation with camera IP metadata.
export const operationsOnly=process.env.OPSVISION_OPERATIONS_ONLY!=='false';

// Re-enabled by the explicit request to analyze the new camera video.
export const videoAnalysisEnabled=process.env.OPSVISION_VIDEO_ANALYSIS!=='false';
