import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricCard } from "@/components/data/metric-card";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmButton } from "@/components/data/confirm-button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

/**
 * The pieces every critical page is built from. Testing them here means the
 * page-level tests can assert on behaviour rather than re-checking that a badge
 * renders its label.
 */

describe("MetricCard", () => {
  it("shows the number with the context needed to act on it", () => {
    render(
      <MetricCard label="Needs review now" value={13} sub="each has a fix" />,
    );

    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("Needs review now")).toBeInTheDocument();
    expect(screen.getByText("each has a fix")).toBeInTheDocument();
  });

  it("becomes a link only when there is somewhere to go", () => {
    const { rerender } = render(<MetricCard label="Concepts" value={9} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(
      <MetricCard label="Concepts" value={9} href="/dashboard/concepts" />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/dashboard/concepts",
    );
  });

  it("renders a zero rather than treating it as absent", () => {
    // `value && ...` would hide the most reassuring number on the dashboard.
    render(<MetricCard label="Failed QA" value={0} sub="nothing to fix" />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("renders its label", () => {
    render(<StatusBadge label="Needs review" tone="warning" />);

    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("explains the absence and offers the way out", () => {
    render(
      <EmptyState
        title="No concepts yet"
        description="Generate some first."
        action={<a href="/dashboard/concepts">Go to concepts</a>}
      />,
    );

    expect(screen.getByText("No concepts yet")).toBeInTheDocument();
    expect(screen.getByText("Generate some first.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to concepts" }),
    ).toHaveAttribute("href", "/dashboard/concepts");
  });
});

describe("PageHeader", () => {
  it("renders the section, title and count as one heading block", () => {
    render(
      <PageHeader eyebrow="Workflow" title="Image QA" subtitle="18 reviewed" />,
    );

    expect(
      screen.getByRole("heading", { name: "Image QA" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Workflow")).toBeInTheDocument();
    expect(screen.getByText("18 reviewed")).toBeInTheDocument();
  });

  it("omits the eyebrow rather than rendering an empty band", () => {
    const { container } = render(<PageHeader title="Dashboard" />);

    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});

describe("ConfirmButton", () => {
  it("does not destroy anything on the first click", async () => {
    const action = vi.fn();
    render(
      <ConfirmButton
        action={action}
        label="Delete"
        question="Delete this concept?"
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this concept?")).toBeInTheDocument();
  });

  it("puts focus on Cancel, not on the destructive option", async () => {
    render(
      <ConfirmButton
        action={vi.fn()}
        label="Delete"
        question="Delete this concept?"
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    // A confirm step that lands focus on "confirm" is a slower way to make the
    // same mistake — Enter would delete.
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("backs out on Escape", async () => {
    const action = vi.fn();
    render(
      <ConfirmButton
        action={action}
        label="Delete"
        question="Delete this concept?"
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.keyboard("{Escape}");

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("backs out on Cancel without acting", async () => {
    const action = vi.fn();
    render(
      <ConfirmButton
        action={action}
        label="Delete"
        question="Delete this concept?"
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
  });
});
