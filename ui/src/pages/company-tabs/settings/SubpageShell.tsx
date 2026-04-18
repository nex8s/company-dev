import { ArrowLeft } from "lucide-react";
import { type ReactNode } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { settingsSubpages as copy } from "@/copy/settings-subpages";

/**
 * Shared chrome for the 5 C-12 Settings sub-pages. Renders a "Back to
 * Settings" link + heading, then the page's content.
 */
export function SubpageShell({
  testId,
  heading,
  children,
}: {
  testId: string;
  heading: string;
  children: ReactNode;
}) {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  return (
    <div data-testid={testId} className="flex flex-col space-y-6">
      <button
        type="button"
        onClick={() => navigate(`/c/${companyId}/settings`)}
        className="text-mist hover:text-ink transition-colors flex items-center gap-1 text-sm self-start"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.5} />
        {copy.common.back}
      </button>
      <h2 className="text-lg font-medium">{heading}</h2>
      {children}
    </div>
  );
}
