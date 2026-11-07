export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: November 2026
          </p>
        </div>

        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              1. Introduction
            </h2>
            <p>
              Welcome to PrepSPSC (&quot;we,&quot; &quot;our,&quot; or
              &quot;us&quot;). By accessing or using our platform at
              prepspsc.com, you agree to be bound by these Terms and Conditions.
              If you do not agree, please do not use the platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              2. Description of Service
            </h2>
            <p>
              PrepSPSC is an online study platform designed for Sikkim Public
              Service Commission (SPSC) exam preparation. We provide AI-powered
              study tools, mock tests, gamification features, and community study
              rooms to help aspirants prepare effectively.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              3. User Accounts
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                You must provide accurate information when creating an account.
              </li>
              <li>
                You are responsible for maintaining the security of your account
                credentials.
              </li>
              <li>
                You must be at least 16 years old to create an account.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that
                violate these terms.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              4. Subscription Plans
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Free Plan: Limited access to basic features with daily usage
                limits.
              </li>
              <li>
                AI Credits: optional prepaid credits (₹50, ₹100 or ₹200 packs)
                that pay for &quot;Better answer&quot; upgrades from a stronger AI
                model, at ₹5 per answer. Credits do not expire, cannot be
                transferred, and are refunded as described in our Refund Policy.
              </li>
              <li>
                Pro Plan: Full access to all premium features, available as
                monthly or yearly subscriptions.
              </li>
              <li>
                Prices are displayed in Indian Rupees (INR) and are inclusive of
                applicable taxes.
              </li>
              <li>
                Subscriptions are non-transferable between accounts.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              5. Payment Terms
            </h2>
            <p>
              Payments are processed securely through Cashfree Payments. By
              making a payment, you agree to Cashfree&apos;s terms of service.
              All payments are in INR. You will receive a confirmation upon
              successful payment.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              6. Intellectual Property
            </h2>
            <p>
              All content on PrepSPSC, including but not limited to text,
              graphics, logos, AI-generated study materials, and software, is the
              property of PrepSPSC or its content suppliers. You may not
              reproduce, distribute, or create derivative works without written
              permission.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              7. User Conduct
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Use the platform for any unlawful purpose.
              </li>
              <li>
                Share or distribute exam content or copyrighted materials.
              </li>
              <li>
                Attempt to gain unauthorized access to our systems.
              </li>
              <li>
                Harass or disrupt other users in study rooms or community
                features.
              </li>
              <li>
                Use automated tools to scrape or extract content from the
                platform.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              8. AI-Generated Content
            </h2>
            <p>
              Our platform uses AI (Google Gemini) to generate study materials.
              While we strive for accuracy, AI-generated content may contain
              errors. Users should verify critical information from official SPSC
              sources. We are not liable for inaccuracies in AI-generated
              content.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              9. Limitation of Liability
            </h2>
            <p>
              PrepSPSC is provided &quot;as is&quot; without warranties of any
              kind. We are not responsible for exam outcomes or results. Our
              total liability shall not exceed the amount paid by you in the
              preceding 12 months.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              10. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these terms at any time. Continued
              use of the platform after changes constitutes acceptance of the
              updated terms. We will notify registered users of significant
              changes via email.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              11. Governing Law
            </h2>
            <p>
              These terms are governed by the laws of India. Any disputes shall
              be subject to the exclusive jurisdiction of the courts in Gangtok,
              Sikkim.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              12. Contact
            </h2>
            <p>
              For any questions regarding these terms, please contact us at{" "}
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
