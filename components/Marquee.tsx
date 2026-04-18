import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

interface MarqueeProps {
  text: string;
  className?: string;
  speed?: number;
}

export const Marquee: React.FC<MarqueeProps> = ({ text, className, speed = 50 }) => {
  const [shouldScroll, setShouldScroll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setShouldScroll(textRef.current.offsetWidth > containerRef.current.offsetWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div 
      ref={containerRef} 
      className={clsx("overflow-hidden whitespace-nowrap relative", className)}
    >
      {shouldScroll ? (
        <motion.div
          animate={{ x: [0, -textRef.current!.offsetWidth - 40] }}
          transition={{
            duration: (textRef.current!.offsetWidth / speed),
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 1
          }}
          className="inline-block"
        >
          <span ref={textRef} className="pr-10">{text}</span>
          <span className="pr-10">{text}</span>
        </motion.div>
      ) : (
        <span ref={textRef}>{text}</span>
      )}
    </div>
  );
};
