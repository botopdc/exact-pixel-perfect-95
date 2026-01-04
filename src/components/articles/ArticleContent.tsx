import { useMemo } from 'react';

interface ArticleContentProps {
  content: string;
}

export function ArticleContent({ content }: ArticleContentProps) {
  const formattedContent = useMemo(() => {
    // Split content into lines
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let currentListItems: string[] = [];
    let isInCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLang = '';

    const flushList = (numbered: boolean) => {
      if (currentListItems.length > 0) {
        const ListTag = numbered ? 'ol' : 'ul';
        elements.push(
          <ListTag
            key={`list-${elements.length}`}
            className={`${numbered ? 'list-decimal' : 'list-disc'} list-inside space-y-1 text-muted-foreground mb-4`}
          >
            {currentListItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ListTag>
        );
        currentListItems = [];
      }
    };

    lines.forEach((line, index) => {
      // Code block handling
      if (line.startsWith('```')) {
        if (isInCodeBlock) {
          // End code block
          elements.push(
            <pre
              key={`code-${elements.length}`}
              className="bg-background rounded-lg p-4 overflow-x-auto mb-4 border border-border"
            >
              <code className="text-sm text-foreground font-mono">
                {codeBlockContent.join('\n')}
              </code>
            </pre>
          );
          codeBlockContent = [];
          isInCodeBlock = false;
        } else {
          // Start code block
          flushList(false);
          isInCodeBlock = true;
          codeBlockLang = line.slice(3);
        }
        return;
      }

      if (isInCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headings
      if (line.startsWith('## ')) {
        flushList(false);
        elements.push(
          <h2
            key={`h2-${index}`}
            className="text-xl font-semibold text-foreground mt-6 mb-3 first:mt-0"
          >
            {line.slice(3)}
          </h2>
        );
        return;
      }

      if (line.startsWith('### ')) {
        flushList(false);
        elements.push(
          <h3
            key={`h3-${index}`}
            className="text-lg font-semibold text-foreground mt-4 mb-2"
          >
            {line.slice(4)}
          </h3>
        );
        return;
      }

      // Numbered list
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (numberedMatch) {
        currentListItems.push(numberedMatch[2]);
        return;
      }

      // Bullet list
      if (line.startsWith('- ')) {
        currentListItems.push(line.slice(2));
        return;
      }

      // Empty line
      if (line.trim() === '') {
        flushList(currentListItems.length > 0 && /^\d+\./.test(content.split('\n')[index - 1] || ''));
        return;
      }

      // Regular paragraph
      flushList(false);
      elements.push(
        <p key={`p-${index}`} className="text-muted-foreground mb-3 leading-relaxed">
          {line}
        </p>
      );
    });

    flushList(false);
    return elements;
  }, [content]);

  return <div className="prose prose-invert max-w-none">{formattedContent}</div>;
}
