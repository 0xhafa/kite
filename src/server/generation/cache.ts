import { unstable_cache } from "next/cache";

import { loadReviewedActivityLibrary } from "./integrated-flow";

export const REVIEWED_ACTIVITY_LIBRARY_CACHE_TAG = "reviewed-activity-library";

export const loadCachedReviewedActivityLibrary = unstable_cache(
  loadReviewedActivityLibrary,
  [REVIEWED_ACTIVITY_LIBRARY_CACHE_TAG],
  {
    revalidate: 30,
    tags: [REVIEWED_ACTIVITY_LIBRARY_CACHE_TAG],
  },
);
