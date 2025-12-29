import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

interface HeroProps {
  onGetStarted: () => void;
}

export const Hero = ({ onGetStarted }: HeroProps) => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      
      <div className="container relative z-10 mx-auto px-4 pt-6 pb-16">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="FollowUp" className="w-24 h-24 md:w-32 md:h-32 animate-fade-in" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Meeting Intelligence</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Transform Your
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Meeting Transcripts </span>
            Into Action
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Automatically extract summaries, action items, follow-up emails, and blockers from your meeting transcripts with AI.
          </p>
          
          <div className="flex justify-center items-center pt-4">
            <Button
              size="lg"
              onClick={onGetStarted}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 group"
            >
              Analyze Transcript
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
