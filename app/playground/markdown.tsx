import React from "react";

function renderInlineMarkdown(
  text: string,
  juniorTokens: Set<string>,
): React.ReactNode {
  const REGEX = /(\*\*[^*]+\*\*|`[^`]+`|0x[0-9A-Fa-f]{4,})/g;

  const parts = text.split(REGEX);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const content = part.slice(2, -2);
      return (
        <strong key={index}>
          {renderInlineMarkdown(content, juniorTokens)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      const content = part.slice(1, -1);
      return (
        <code
          key={index}
          className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 font-mono text-xs"
        >
          {content}
        </code>
      );
    }
    if (part.startsWith("0x")) {
      const restricted = !juniorTokens.has(part);
      return (
        <span
          key={index}
          className={
            restricted
              ? "rounded bg-violet-100 dark:bg-violet-950 px-1 font-mono text-violet-700 dark:text-violet-300 font-semibold"
              : "font-mono font-semibold"
          }
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export function parseMarkdown(
  text: string,
  juniorTokens: Set<string>,
): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let activeListType: "ul" | "ol" | null = null;
  let listItems: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const closeTable = (keyIndex: number) => {
    if (!inTable) return;
    elements.push(
      <div
        key={`table-container-${keyIndex}`}
        className="my-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
      >
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold">
            <tr>
              {tableHeaders.map((header, idx) => (
                <th key={idx} className="px-4 py-3 font-semibold">
                  {renderInlineMarkdown(header, juniorTokens)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300">
            {tableRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-2.5 font-normal">
                    {renderInlineMarkdown(cell, juniorTokens)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  const closeList = (keyIndex: number) => {
    if (!activeListType) return;
    if (activeListType === "ul")
      elements.push(
        <ul
          key={`ul-${keyIndex}`}
          className="list-disc pl-5 my-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300"
        >
          {listItems}
        </ul>,
      );
    else
      elements.push(
        <ol
          key={`ol-${keyIndex}`}
          className="list-decimal pl-5 my-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300"
        >
          {listItems}
        </ol>,
      );
    listItems = [];
    activeListType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (line.startsWith("```")) {
      closeTable(i);
      closeList(i);
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-2 overflow-x-auto rounded bg-zinc-100 dark:bg-zinc-800 p-3 font-mono text-xs text-zinc-800 dark:text-zinc-200"
          >
            <code>{codeBlockContent.join("\n")}</code>
          </pre>,
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else inCodeBlock = true;
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|");
    if (isTableRow) {
      closeList(i);
      if (inTable) {
        const isSeparator = /^[\s|:-]+$/.test(trimmed);
        if (!isSeparator) {
          const cells = line
            .split("|")
            .map((c) => c.trim())
            .slice(1, -1);
          tableRows.push(cells);
        }
      } else {
        const nextLine = lines[i + 1];
        const nextLineTrimmed = nextLine ? nextLine.trim() : "";
        const isNextSeparator =
          nextLineTrimmed.startsWith("|") && /^[\s|:-]+$/.test(nextLineTrimmed);

        if (isNextSeparator) {
          inTable = true;
          tableHeaders = line
            .split("|")
            .map((c) => c.trim())
            .slice(1, -1);
          i++;
        } else
          elements.push(
            <p
              key={`p-${i}`}
              className="my-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
            >
              {renderInlineMarkdown(line, juniorTokens)}
            </p>,
          );
      }
      continue;
    } else closeTable(i);

    const olMatch = line.match(/^\s*\d+\.\s+(.*)/);
    const ulMatch = line.match(/^\s*[-*+]\s+(.*)/);

    if (olMatch) {
      if (activeListType !== "ol") {
        closeList(i);
        activeListType = "ol";
      }
      listItems.push(
        <li key={`li-${i}`}>
          {renderInlineMarkdown(olMatch[1], juniorTokens)}
        </li>,
      );
      continue;
    } else if (ulMatch) {
      if (activeListType !== "ul") {
        closeList(i);
        activeListType = "ul";
      }
      listItems.push(
        <li key={`li-${i}`}>
          {renderInlineMarkdown(ulMatch[1], juniorTokens)}
        </li>,
      );
      continue;
    } else {
      closeList(i);
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="mt-4 mb-2 text-base font-semibold text-zinc-950 dark:text-white"
        >
          {renderInlineMarkdown(line.slice(4), juniorTokens)}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="mt-5 mb-2 text-lg font-semibold text-zinc-950 dark:text-white"
        >
          {renderInlineMarkdown(line.slice(3), juniorTokens)}
        </h2>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className="mt-6 mb-3 text-xl font-bold text-zinc-950 dark:text-white"
        >
          {renderInlineMarkdown(line.slice(2), juniorTokens)}
        </h1>,
      );
      continue;
    }

    if (line.trim() === "") continue;

    elements.push(
      <p
        key={`p-${i}`}
        className="my-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
      >
        {renderInlineMarkdown(line, juniorTokens)}
      </p>,
    );
  }

  closeTable(lines.length);
  closeList(lines.length);
  if (inCodeBlock)
    elements.push(
      <pre
        key="code-end"
        className="my-2 overflow-x-auto rounded bg-zinc-100 dark:bg-zinc-800 p-3 font-mono text-xs text-zinc-800 dark:text-zinc-200"
      >
        <code>{codeBlockContent.join("\n")}</code>
      </pre>,
    );

  return <div className="space-y-1">{elements}</div>;
}
