import type { LinkPreview } from '../../utils/linkPreview';

interface LinkPreviewComponentProps {
  link: LinkPreview;
}

export function LinkPreviewComponent({ link }: LinkPreviewComponentProps) {

  if (link.type === 'youtube') {
    return (
      <>
        <div className="my-3 rounded-lg overflow-hidden bg-black aspect-video max-w-sm">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${link.id}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Watch on YouTube →
        </a>
      </>
    );
  }

  if (link.type === 'instagram') {
    return (
      <div className="my-3 rounded-lg overflow-hidden max-w-sm bg-[var(--surface)] border border-[var(--border)] p-4">
        <div className="aspect-square rounded-lg overflow-hidden bg-black flex items-center justify-center mb-2">
          <iframe
            src={`https://www.instagram.com/p/${link.id}/embed/captioned/`}
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            allowTransparency
            className="min-h-96"
          />
        </div>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--accent)] hover:underline"
        >
          View on Instagram →
        </a>
      </div>
    );
  }

  return null;
}
