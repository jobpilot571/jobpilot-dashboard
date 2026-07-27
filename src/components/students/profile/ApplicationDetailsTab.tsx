import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isFeatureEnabled } from "@/lib/feature-flags";

export function StudentApplicationDetailsTab() {
  const enabled = isFeatureEnabled("appDetailsModule");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Application details</CardTitle>
        <CardDescription>
          Secure document vault and token form for IDs, visa, and related files.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {enabled ? (
          <p>Application details module is enabled — wire the vault UI here.</p>
        ) : (
          <p>
            This module is deferred in v1 (<code className="text-xs">appDetailsModule</code> is off).
            Use the Documents checklist on the student portal and coordinator workflows for now.
            Enable the flag when the token form / vault is ready to ship.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
