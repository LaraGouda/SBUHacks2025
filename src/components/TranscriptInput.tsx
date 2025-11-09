import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Wand2, AlertCircle, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

interface TranscriptInputProps {
  onAnalyze: (transcript: string) => void;
  isLoading?: boolean;
}

const MAX_LENGTH = 50000;
const MIN_LENGTH = 50;

export const TranscriptInput = ({ onAnalyze, isLoading }: TranscriptInputProps) => {
  const [transcript, setTranscript] = useState("");
  const [validationError, setValidationError] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTranscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTranscript(value);
    
    // Clear validation error when user types
    if (validationError) {
      setValidationError("");
    }
    
    // Show warning if approaching limit
    if (value.length > MAX_LENGTH) {
      setValidationError(`Transcript exceeds maximum length of ${MAX_LENGTH.toLocaleString()} characters.`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith('.txt')) {
      setValidationError("Please upload a .txt file");
      return;
    }

    // Check file size (20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      setValidationError("File size must be less than 20MB");
      return;
    }

    try {
      const text = await file.text();
      setTranscript(text);
      setUploadedFileName(file.name);
      setValidationError("");
    } catch (error) {
      setValidationError("Failed to read file. Please try again.");
    }
  };

  const handleAnalyze = () => {
    const trimmedTranscript = transcript.trim();
    
    if (!trimmedTranscript) {
      setValidationError("Please enter a transcript to analyze.");
      return;
    }
    
    if (trimmedTranscript.length < MIN_LENGTH) {
      setValidationError(`Transcript must be at least ${MIN_LENGTH} characters long.`);
      return;
    }
    
    if (trimmedTranscript.length > MAX_LENGTH) {
      setValidationError(`Transcript must not exceed ${MAX_LENGTH.toLocaleString()} characters.`);
      return;
    }
    
    setValidationError("");
    onAnalyze(trimmedTranscript);
  };

  const charCount = transcript.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const isUnderLimit = transcript.trim().length > 0 && transcript.trim().length < MIN_LENGTH;

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Meeting Transcript
        </CardTitle>
        <CardDescription>
          Paste your meeting transcript below to extract insights
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-shrink-0"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload .txt File
            </Button>
            {uploadedFileName && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {uploadedFileName}
              </span>
            )}
          </div>
          <Textarea
            placeholder="Paste your meeting transcript here...&#10;&#10;Example:&#10;John: Let's discuss the Q4 roadmap.&#10;Sarah: We need to prioritize the mobile app redesign.&#10;John: Agreed. What are the main blockers?&#10;Sarah: We're waiting on the API documentation from the backend team..."
            value={transcript}
            onChange={handleTranscriptChange}
            className={`min-h-[300px] resize-none ${isOverLimit ? 'border-destructive' : ''}`}
            disabled={isLoading}
            maxLength={MAX_LENGTH + 1000}
          />
          <div className="flex justify-between items-center text-sm">
            <span className={`text-muted-foreground ${isOverLimit ? 'text-destructive' : isUnderLimit ? 'text-yellow-600' : ''}`}>
              {charCount.toLocaleString()} / {MAX_LENGTH.toLocaleString()} characters
              {isUnderLimit && ` (minimum ${MIN_LENGTH})`}
            </span>
          </div>
        </div>
        
        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex justify-end">
          <Button
            onClick={handleAnalyze}
            disabled={!transcript.trim() || isLoading || isOverLimit}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Analyze Transcript
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
