import { extractLinks } from '../../utils/linkPreview';
import { LinkPreviewComponent } from './LinkPreview';

interface MessageWithLinksProps {
  text: string;
}

export function MessageWithLinks({ text }: MessageWithLinksProps) {
  const links = extractLinks(text);

  return (
    <div>
      <div>{text}</div>
      {links.map((link, idx) => (
        <LinkPreviewComponent key={idx} link={link} />
      ))}
    </div>
  );
}
