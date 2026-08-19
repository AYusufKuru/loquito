"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** Sunucudan gelen güncel props ile yerel liste durumunu senkron tutar. */
export function useLiveState<T>(
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(initial);

  useEffect(() => {
    setState(initial);
  }, [initial]);

  return [state, setState];
}
