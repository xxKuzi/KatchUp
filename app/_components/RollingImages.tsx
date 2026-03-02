import React from "react";

function RollingImages() {
  const images = [
    { url: "one_of_three.png", alt: "One of Three" },
    { url: "flip_cards.png", alt: "Flip Cards" },
    { url: "guess_match.png", alt: "Guess Match" },
    { url: "one_of_three.png", alt: "One of Three" },
    { url: "flip_cards.png", alt: "Flip Cards" },
    { url: "guess_match.png", alt: "Guess Match" },
    { url: "one_of_three.png", alt: "One of Three" },
    { url: "flip_cards.png", alt: "Flip Cards" },
    { url: "guess_match.png", alt: "Guess Match" },
  ];

  return (
    // 1. OUTER WRAPPER: Takes full width and hides anything that spills over
    <div className="w-screen overflow-hidden py-4">
      {/* 2. MOVING TRACK: This gets the animation and holds both sets of images */}
      <div className="flex w-max gap-4 animate-marquee-lr">
        {/* Set 1: The original images */}
        {images.map((image, index) => (
          <img
            key={`original-${index}`}
            src={image.url}
            alt={image.alt}
            className="w-64 h-64 object-cover rounded-lg shadow-md shrink-0"
          />
        ))}

        {/* Set 2: The exact duplicates required to make the loop seamless */}
        {images.map((image, index) => (
          <img
            key={`duplicate-${index}`}
            src={image.url}
            alt={image.alt}
            className="w-64 h-64 object-cover rounded-lg shadow-md shrink-0"
          />
        ))}
      </div>
    </div>
  );
}

export default RollingImages;
