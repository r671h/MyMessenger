const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function linkify(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);

  return parts.map((part, i) => {
    if (part.match(URL_REGEX)) {
      // Trim trailing punctuation that's likely part of the sentence, not the URL
      // e.g. "check this out: https://example.com." shouldn't include the trailing period
      const trailingPunctuation = part.match(/[.,!?;:)]+$/)?.[0] || '';
      const cleanUrl = trailingPunctuation ? part.slice(0, -trailingPunctuation.length) : part;

      return (
        <span key={i}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[#7EC1FF] hover:text-white break-all"
            onClick={(e) => e.stopPropagation()} // don't trigger long-press/click handlers on the bubble
          >
            {cleanUrl}
          </a>
          {trailingPunctuation}
        </span>
      );
    }
    return part;
  });
}