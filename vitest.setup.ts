import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Shared setup for the component suite.
 *
 * next/navigation is stubbed here rather than in each test: almost every
 * component under test either links somewhere or reads the current path, and
 * without a stub they throw outside the App Router. The router mock is a plain
 * spy set so a test can assert navigation without asserting on Next internals.
 */

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

let pathname = "/dashboard";
let searchParams = new URLSearchParams();

export function setPathname(value: string) {
  pathname = value;
}
export function setSearchParams(value: string) {
  searchParams = new URLSearchParams(value);
}

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
  notFound: () => {
    throw new Error("notFound");
  },
}));

// jsdom implements neither, and components that copy to the clipboard or
// observe layout would otherwise fail on the environment rather than on their
// own behaviour.
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  pathname = "/dashboard";
  searchParams = new URLSearchParams();
});
