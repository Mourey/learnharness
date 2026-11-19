"use client";

import { parseInline } from '@/src/core';

export default function Inline({ text }: { text: string }) {
  return <>{parseInline(text).map((part, index) => {
    switch (part.kind) {
      case 'strong': return <strong key={index}>{part.text}</strong>;
      case 'em': return <em key={index}>{part.text}</em>;
      case 'code': return <code key={index}>{part.text}</code>;
      case 'term': return <dfn key={index} className="lesson-term">{part.text}</dfn>;
      default: return part.text;
    }
  })}</>;
}
