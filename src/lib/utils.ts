import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const parseVisitTimestamp = (timestamp: unknown): Date => {
  if (timestamp instanceof Date && !Number.isNaN(timestamp.getTime())) {
    return timestamp;
  }

  if (timestamp && typeof timestamp === 'object') {
    const firestoreTimestamp = timestamp as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof firestoreTimestamp.toDate === 'function') {
      const converted = firestoreTimestamp.toDate();
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted;
      }
    }

    const seconds = typeof firestoreTimestamp.seconds === 'number'
      ? firestoreTimestamp.seconds
      : firestoreTimestamp._seconds;

    if (typeof seconds === 'number') {
      const converted = new Date(seconds * 1000);
      if (!Number.isNaN(converted.getTime())) {
        return converted;
      }
    }
  }

  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const converted = new Date(timestamp);
    if (!Number.isNaN(converted.getTime())) {
      return converted;
    }
  }

  return new Date();
};