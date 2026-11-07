import { Mail, MapPin, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
          <p className="text-muted-foreground">
            Have questions or need help? Reach out to us.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
            <Mail className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Email</h3>
              <a
                href="mailto:prepspsc@gmail.com"
                className="text-primary hover:underline"
              >
                prepspsc@gmail.com
              </a>
              <p className="text-sm text-muted-foreground mt-1">
                We typically respond within 24 hours.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
            <MapPin className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Address</h3>
              <p className="text-muted-foreground">
                Gangtok, Sikkim, India - 737101
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
            <Clock className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Support Hours</h3>
              <p className="text-muted-foreground">
                Monday - Saturday, 9:00 AM - 6:00 PM IST
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground pt-4 border-t border-white/10">
          <p>PrepSPSC - Sikkim PSC Exam Preparation Platform</p>
        </div>
      </div>
    </div>
  );
}
