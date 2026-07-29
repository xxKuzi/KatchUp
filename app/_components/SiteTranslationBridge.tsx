"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "../_lib/languageContext";
import { translateLegacyUiText } from "../_lib/legacyUiText";

const TRANSLATED_ATTRIBUTES = [
  "aria-label",
  "placeholder",
  "title",
  "content",
] as const;

/**
 * Localizes interface copy on older screens that have not yet moved every
 * label to the keyed catalogue.
 */
export default function SiteTranslationBridge() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const textSourcesRef = useRef(new WeakMap<Text, string>());
  const attributeSourcesRef = useRef(
    new WeakMap<Element, Map<string, string>>(),
  );
  const titleSourcesRef = useRef(new Map<string, string>());

  useEffect(() => {
    document.documentElement.lang = language;

    const titleSource = titleSourcesRef.current.get(pathname) ?? document.title;
    titleSourcesRef.current.set(pathname, titleSource);
    document.title = translateLegacyUiText(titleSource, language);

    const textSources = textSourcesRef.current;
    const attributeSources = attributeSourcesRef.current;
    let translating = false;

    const translateTextNode = (node: Text) => {
      const remembered = textSources.get(node);
      let source = remembered ?? node.data;
      if (
        remembered &&
        node.data !== remembered &&
        node.data !== translateLegacyUiText(remembered, language)
      ) {
        source = node.data;
      }
      const translated = translateLegacyUiText(source, language);
      if (translated !== source || remembered) {
        textSources.set(node, source);
        if (node.data !== translated) node.data = translated;
      }
    };

    const translateElement = (element: Element) => {
      let sources = attributeSources.get(element);
      if (!sources) {
        sources = new Map();
        attributeSources.set(element, sources);
      }

      for (const attribute of TRANSLATED_ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (value === null) continue;
        const remembered = sources.get(attribute);
        let source = remembered ?? value;
        if (
          remembered &&
          value !== remembered &&
          value !== translateLegacyUiText(remembered, language)
        ) {
          source = value;
        }
        const translated = translateLegacyUiText(source, language);
        if (translated !== source || remembered) {
          sources.set(attribute, source);
          if (value !== translated) element.setAttribute(attribute, translated);
        }
      }
    };

    const translateTree = (root: Node) => {
      translating = true;
      if (root.nodeType === Node.TEXT_NODE) translateTextNode(root as Text);
      if (root.nodeType === Node.ELEMENT_NODE) translateElement(root as Element);

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      );
      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
        else translateElement(node as Element);
        node = walker.nextNode();
      }
      translating = false;
    };

    translateTree(document.body);

    const observer = new MutationObserver((mutations) => {
      if (translating) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTree(mutation.target);
        } else {
          mutation.addedNodes.forEach(translateTree);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language, pathname]);

  return null;
}
