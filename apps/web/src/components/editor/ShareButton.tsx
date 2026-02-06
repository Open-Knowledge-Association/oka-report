import { useState } from "react";
import { Share2, Link, Twitter, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  editorId: string;
  username: string;
}

export function ShareButton({ editorId, username }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const profileUrl = `${window.location.origin}/editors/${editorId}`;

  const handleCopyLink = async () => {
    setIsSharing(true);
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: "Link copied",
        description: "Profile URL copied to clipboard",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareTwitter = () => {
    const text = `Check out ${username}'s Wikipedia contributions on OKA!`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, "_blank", "width=600,height=400");
  };

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
    window.open(url, "_blank", "width=600,height=400");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-testid="share-button" variant="outline" size="sm" disabled={isSharing}>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyLink}>
          <Link className="w-4 h-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareTwitter}>
          <Twitter className="w-4 h-4 mr-2" />
          Share on Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleShareLinkedIn}>
          <Linkedin className="w-4 h-4 mr-2" />
          Share on LinkedIn
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
