import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface HeroProps {
  onGetStarted: () => void;
}

export const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      
      <div className="container relative z-10 mx-auto px-4 pt-6 pb-16">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="flex flex-col items-center py-4 mb-8">
            <img src="/logo.png" alt="FollowUp" className="w-24 h-24 md:w-32 md:h-32 animate-fade-in" />
            <h2 className="mt-3 text-6xl md:text-8xl font-bold tracking-tight leading-none text-[#4B2E1F] underline decoration-[#4B2E1F] underline-offset-8">
              FollowUp
            </h2>
          </div>
          
          <h1 className="mx-auto text-center text-xl md:text-3xl lg:text-4xl font-bold tracking-tight">
            Transform Your
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Meeting Transcripts </span>
            Into Action
          </h1>

          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Automatically extract summaries, action items, follow-up emails, and blockers from your meeting transcripts with AI.
          </p>
          
          <div className="flex justify-center items-center py-10">
            <Button
              size="lg"
              onClick={onGetStarted}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 group"
            >
              Analyze Transcript
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="mx-auto max-w-3xl rounded-2xl border-2 border-dashed border-[#4B2E1F]/35 bg-gradient-to-r from-[#4B2E1F]/8 to-[#4B2E1F]/3 px-5 py-4 text-left shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4B2E1F]">
              Project Update
            </p>
            <p className="mt-2 text-xs md:text-sm leading-relaxed text-foreground/90">
              This project is currently on a brief hiatus due to expired hackathon access to the NeuralSeek API.
              We&apos;re exploring replacement options and will be back soon. Click{" "}
              <Link
                to="/picture-walkthrough"
                className="font-semibold underline decoration-2 underline-offset-4 transition hover:text-[#4B2E1F]"
              >
                here
              </Link>{" "}
              for project photos and screenshots.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
