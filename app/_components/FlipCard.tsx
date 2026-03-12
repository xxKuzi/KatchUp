"use client";
interface FlipCardProps {
  foreign: string;
  native: string;
  isForeign: boolean;
  flipCard: () => void;
  index?: number;
}

export default function FlipCard(props: FlipCardProps) {
  const { foreign, native, isForeign, flipCard, index } = props;
  return (
    <button onClick={() => flipCard()}>
      <div className="border-2 rounded-xl px-8 py-16 relative">
        <p className="absolute right-2 top-2 text-sm text-gray-300">
          {isForeign ? "foreign" : "native"}
        </p>
        {typeof index === "number" && (
          <p className="absolute left-2 top-2 text-sm text-gray-300">#{index}</p>
        )}
        <p>word</p>

        <p className="text-3xl">{isForeign ? foreign : native}</p>
      </div>
    </button>
  );
}
