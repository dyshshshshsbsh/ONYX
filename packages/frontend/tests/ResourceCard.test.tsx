import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ResourceCard } from "../src/components/ResourceCard";

afterEach(() => cleanup());

describe("ResourceCard", () => {
  it("renders the unavailable state with its reason instead of a value", () => {
    render(<ResourceCard icon={null} title="GPU" value={null} history={[]} unavailableReason="nvidia-smi not found on this system." />);
    expect(screen.getByText("GPU")).toBeTruthy();
    expect(screen.getByText("nvidia-smi not found on this system.")).toBeTruthy();
  });

  it("renders a rounded value and subtitle when data is available", () => {
    render(<ResourceCard icon={null} title="CPU" value={42.7} subtitle="Test CPU" history={[]} />);
    expect(screen.getByText("43")).toBeTruthy();
    expect(screen.getByText("Test CPU")).toBeTruthy();
  });

  it("does not render a trend delta with fewer than two history points", () => {
    render(<ResourceCard icon={null} title="CPU" value={10} history={[{ t: 1, v: 10 }]} />);
    expect(screen.queryByText(/\/ min/)).toBeNull();
  });
});
