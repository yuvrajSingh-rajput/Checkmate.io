import { Classification } from "../lib/chess/classification";

// This file provides a typed interface for classification counts
export interface ClassificationCount extends Record<Classification, number> {}