export default function TypingDots() {
    return(
        <div className="bg-[#182533] rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-1 w-fit">
      <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce" />
    </div>
  );
}