import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Purchase Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your purchase was cancelled. No charges were made.
          </p>
          <a href="/dashboard/billing">
            <Button>Back to Billing</Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
