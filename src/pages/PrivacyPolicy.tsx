import { AppHeader } from "@/components/AppHeader";
import { NavLink } from "@/components/NavLink";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader showBack />
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">
              <strong>Last updated:</strong> January 08, 2026
            </p>
          </header>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              This Privacy Policy describes how FollowUp ("FollowUp," "we," "us," or "our") collects,
              uses, discloses, and protects information when you use our website and web application
              (the "Service"). It also explains your privacy rights and how you can contact us about
              privacy-related questions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Definitions</h2>
            <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground">
              <li>
                <strong>Account</strong>: A unique account created for you to access the Service.
              </li>
              <li>
                <strong>Company</strong>: FollowUp.
              </li>
              <li>
                <strong>Cookies</strong>: Small files placed on your device to enable certain features
                and analytics.
              </li>
              <li>
                <strong>Device</strong>: Any device that can access the Service (computer, phone,
                tablet).
              </li>
              <li>
                <strong>Personal Data</strong>: Information that identifies or can reasonably identify
                an individual.
              </li>
              <li>
                <strong>Service</strong>: The FollowUp website and associated web application.
              </li>
              <li>
                <strong>Service Provider</strong>: A vendor that processes data on our behalf to operate
                the Service.
              </li>
              <li>
                <strong>Usage Data</strong>: Data collected automatically about how the Service is
                accessed and used.
              </li>
              <li>
                <strong>Website</strong>: FollowUp, accessible at{" "}
                <a
                  className="underline underline-offset-4 transition hover:text-foreground"
                  href="https://followup.codes"
                  target="_blank"
                  rel="noopener"
                >
                  followup.codes
                </a>
                .
              </li>
              <li>
                <strong>You</strong>: The individual accessing or using the Service.
              </li>
            </ul>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>

            <h3 className="text-base font-semibold text-foreground">2.1 Information You Provide</h3>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Email address</strong> (for sign-in, support, and account-related communications)
              </li>
              <li>
                <strong>Account profile information</strong> you choose to provide (where applicable)
              </li>
              <li>
                <strong>Support communications</strong> (messages you send to us)
              </li>
            </ul>

            <h3 className="text-base font-semibold text-foreground">2.2 Usage Data (Collected Automatically)</h3>
            <p>
              When you use the Service, we may collect Usage Data such as IP address, browser
              type/version, pages visited, time/date of visit, time spent on pages, device identifiers,
              and diagnostic logs. This data is used to operate, maintain, and improve the Service.
            </p>

            <h3 className="text-base font-semibold text-foreground">2.3 Cookies and Similar Technologies</h3>
            <p>
              We use cookies and similar technologies (for example, local storage, pixels) to provide
              essential functionality, remember preferences, and understand Service usage. You can
              control cookies through your browser settings; however, disabling cookies may impact
              certain features.
            </p>
            <p>
              <strong>Types of cookies we may use:</strong>
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Essential cookies</strong>: Required for login, security, and core
                functionality.
              </li>
              <li>
                <strong>Preference cookies</strong>: Remember settings (for example, language, session
                state).
              </li>
              <li>
                <strong>Analytics cookies</strong> (if enabled): Help us understand how the Service is
                used to improve performance.
              </li>
            </ul>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">
              3. Google OAuth and Google User Data (Important)
            </h2>
            <p>
              If you choose to sign in with Google (Google OAuth), you will be asked to grant
              permissions (scopes). We only access Google user data as authorized by you and as needed
              to provide the features you request.
            </p>

            <h3 className="text-base font-semibold text-foreground">3.1 Data Accessed from Google</h3>
            <p>The specific Google data we access depends on the permissions you grant. This may include:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Basic Google account info</strong> such as your name and email address (for
                authentication and account creation)
              </li>
              <li>
                <strong>Google account identifier</strong> (to link your Google sign-in to your FollowUp
                account)
              </li>
              <li>
                <strong>OAuth tokens</strong> (access and/or refresh tokens) needed to keep you signed in
                and to access approved Google features
              </li>
              <li>
                <strong>Gmail data</strong> (if you explicitly authorize Gmail scopes), such as email
                metadata (for example, sender, subject, date/time) and/or message content as required
                for the feature you invoke
              </li>
              <li>
                <strong>Google Calendar data</strong> (if you explicitly authorize Calendar scopes),
                such as event metadata and/or event details as required for the feature you invoke
              </li>
            </ul>
            <p>
              We do not access Google data that you have not authorized. If a feature requires access
              to additional Google data, we will request your explicit consent through the Google
              permission prompt.
            </p>

            <h3 className="text-base font-semibold text-foreground">3.2 How We Use Google User Data</h3>
            <p>We use Google user data only for the following purposes:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>To authenticate you and manage your account</li>
              <li>
                To provide the specific functionality you request (for example, reading or organizing
                authorized Gmail/Calendar information)
              </li>
              <li>To maintain the Service (security, debugging, preventing abuse)</li>
              <li>
                To improve reliability and performance of the Service (using aggregated or
                de-identified information where feasible)
              </li>
            </ul>
            <p>
              <strong>We do not use Google user data for advertising, profiling, or selling data.</strong>
            </p>

            <h3 className="text-base font-semibold text-foreground">3.3 Google User Data Sharing</h3>
            <p>
              <strong>
                We do not sell, rent, or share Google user data with third parties
              </strong>{" "}
              except as described below:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Service Providers</strong> that host or operate the Service (for example, cloud
                hosting, databases, error monitoring), solely to provide and secure the Service
              </li>
              <li>
                <strong>Legal requirements</strong>, if required by law or valid governmental request
              </li>
            </ul>
            <p>
              Any Service Providers we use must process data under confidentiality obligations and only
              for our instructions to deliver the Service.
            </p>

            <h3 className="text-base font-semibold text-foreground">
              3.4 Google API Services User Data Policy Compliance
            </h3>
            <p>
              FollowUp's use and transfer of information received from Google APIs adheres to the{" "}
              <strong>Google API Services User Data Policy</strong>, including the{" "}
              <strong>Limited Use</strong> requirements. Information obtained from Google APIs is used
              only to provide or improve user-facing features of the Service and not for advertising.
            </p>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">4. How We Use Personal Data (General)</h2>
            <p>We may use Personal Data to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Provide, operate, and maintain the Service</li>
              <li>Create and manage your Account</li>
              <li>Respond to requests and provide customer support</li>
              <li>Send important account/service notices (for example, security, functional updates)</li>
              <li>Monitor and prevent fraud, abuse, and security incidents</li>
              <li>Analyze usage to improve the Service</li>
            </ul>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">
              5. Legal Bases for Processing (Where Applicable)
            </h2>
            <p>
              Depending on your location, we process Personal Data under one or more legal bases, such
              as: your consent (for example, Google OAuth permissions), performance of a contract
              (providing the Service), compliance with legal obligations, and legitimate interests
              (security and improving the Service).
            </p>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">6. Data Storage and Security</h2>
            <p>
              We implement reasonable administrative, technical, and organizational safeguards designed
              to protect your information. These may include encryption in transit (for example, HTTPS),
              access controls, least-privilege permissions, and monitoring for unauthorized access.
            </p>
            <p>
              No method of transmission or storage is 100% secure. While we strive to protect your
              information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
            <p>
              We retain Personal Data only as long as necessary to provide the Service and for
              legitimate business needs such as security, dispute resolution, and enforcing agreements.
              Usage Data is generally retained for a shorter period unless needed for security and
              Service improvement.
            </p>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">8. Your Choices and Rights</h2>

            <h3 className="text-base font-semibold text-foreground">8.1 Access, Update, and Deletion</h3>
            <p>
              You may request access to, correction of, or deletion of your Personal Data by contacting
              us at the email listed in Section 12. Where available, you may also update certain
              information through your account settings.
            </p>

            <h3 className="text-base font-semibold text-foreground">8.2 Revoking Google Access</h3>
            <p>
              You can revoke FollowUp's access to your Google account at any time via your Google
              Account settings. Revoking access may limit or disable Google-connected features in the
              Service.
            </p>

            <h3 className="text-base font-semibold text-foreground">8.3 Data Deletion Requests</h3>
            <p>
              To request deletion of your account and associated data (including Google-related data we
              store), contact us at{" "}
              <a
                className="underline underline-offset-4 transition hover:text-foreground"
                href="mailto:josephabinu2006@gmail.com"
              >
                josephabinu2006@gmail.com
              </a>
              {" "}or{" "}
              <a
                className="underline underline-offset-4 transition hover:text-foreground"
                href="mailto:lara.gouda@hotmail.com"
              >
                lara.gouda@hotmail.com
              </a>
              . We will delete your data within a reasonable timeframe, unless we are legally required
              to retain certain information.
            </p>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">9. Disclosure of Information</h2>
            <h3 className="text-base font-semibold text-foreground">9.1 Service Providers</h3>
            <p>
              We may use Service Providers to host and operate the Service. They may process Personal
              Data only on our instructions and for the purpose of providing the Service.
            </p>

            <h3 className="text-base font-semibold text-foreground">9.2 Business Transfers</h3>
            <p>
              If we are involved in a merger, acquisition, financing, or sale of assets, Personal Data
              may be transferred as part of that transaction. We will provide notice if your data
              becomes subject to a different privacy policy.
            </p>

            <h3 className="text-base font-semibold text-foreground">9.3 Legal Requirements</h3>
            <p>
              We may disclose information if required to do so by law or in response to valid requests
              by public authorities (for example, a court or government agency), or to protect the
              rights, property, or safety of the Company, our users, or others.
            </p>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">10. International Transfers</h2>
            <p>
              Your information may be processed in locations where we or our Service Providers operate.
              Data protection laws may differ from those in your jurisdiction. We take reasonable steps
              to ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">11. Children's Privacy</h2>
            <p>
              The Service is not directed to children under 13, and we do not knowingly collect
              Personal Data from children under 13. If you believe a child has provided us Personal
              Data, please contact us so we can take appropriate action.
            </p>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">12. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your privacy rights,
              contact:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Email:{" "}
                <a
                  className="underline underline-offset-4 transition hover:text-foreground"
                  href="mailto:josephabinu2006@gmail.com"
                >
                  josephabinu2006@gmail.com
                </a>
              </li>
              <li>
                Email:{" "}
                <a
                  className="underline underline-offset-4 transition hover:text-foreground"
                  href="mailto:lara.gouda@hotmail.com"
                >
                  lara.gouda@hotmail.com
                </a>
              </li>
            </ul>
          </section>

          <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">13. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated version on
              this page and update the "Last updated" date above. Your continued use of the Service
              after changes become effective constitutes acceptance of the updated policy.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t mt-0 py-1">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <span>© 2025 FollowUp. Transform your meetings into actionable insights.</span>
            <NavLink
              className="underline underline-offset-4 transition hover:text-foreground"
              to="/privacypolicy"
            >
              Privacy Policy
            </NavLink>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
