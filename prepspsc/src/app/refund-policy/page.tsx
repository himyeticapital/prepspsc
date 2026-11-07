export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Refunds and Cancellation Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: January 2026
          </p>
        </div>

        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              1. Cancellation Policy
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                You may cancel your Pro subscription at any time from your
                account settings.
              </li>
              <li>
                Upon cancellation, you will continue to have access to Pro
                features until the end of your current billing period.
              </li>
              <li>
                After the billing period ends, your account will revert to the
                Free plan.
              </li>
              <li>
                Cancellation does not trigger an automatic refund for the
                remaining period.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              2. Refund Eligibility
            </h2>
            <p>You may be eligible for a refund in the following cases:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Within 48 hours of purchase:</strong> If you are
                unsatisfied with the Pro features and have not used
                the premium services, you may request a full refund.
              </li>
              <li>
                <strong>Technical issues:</strong> If a technical issue on our
                end prevents you from accessing Pro features for an extended
                period (more than 48 hours), you may request a pro-rated refund.
              </li>
              <li>
                <strong>Duplicate payment:</strong> If you were charged multiple
                times for the same subscription, the duplicate charges will be
                refunded in full.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              3. Non-Refundable Cases
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Requests made after 48 hours of purchase (unless due to technical
                issues).
              </li>
              <li>
                Dissatisfaction with exam results or outcomes.
              </li>
              <li>
                Violation of our Terms and Conditions leading to account
                suspension.
              </li>
              <li>
                Change of mind after extensively using premium features (AI
                generations, premium tests, etc.).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              4. How to Request a Refund
            </h2>
            <p>To request a refund:</p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>
                Email us at{" "}
                <a
                  href="mailto:prepspsc@gmail.com"
                  className="text-primary hover:underline"
                >
                  prepspsc@gmail.com
                </a>{" "}
                with the subject line &quot;Refund Request.&quot;
              </li>
              <li>
                Include your registered email address and the reason for the
                refund.
              </li>
              <li>
                Provide your payment transaction ID or order reference number.
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              5. Refund Processing
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Approved refunds will be processed within 5-7 business days.
              </li>
              <li>
                Refunds will be credited to the original payment method used
                during purchase.
              </li>
              <li>
                You will receive an email confirmation once the refund is
                initiated.
              </li>
              <li>
                Bank processing times may vary; please allow up to 10 business
                days for the amount to reflect in your account.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              6. Subscription Renewals
            </h2>
            <p>
              Subscriptions do not auto-renew. You will need to manually
              resubscribe when your current billing period ends. We will send a
              reminder email before your subscription expires.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              7. Contact Us
            </h2>
            <p>
              For any questions about refunds or cancellations, reach out to us
              at{" "}
              <a
                href="mailto:prepspsc@gmail.com"
                className="text-primary hover:underline"
              >
                prepspsc@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
