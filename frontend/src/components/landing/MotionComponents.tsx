import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * SpotlightCard inspired by ReactBits & Motion Primitives
 * Dynamically tracks mouse position and casts a glowing radial spotlight 
 * on the card's surface and borders.
 */
export const SpotlightCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  onClick?: () => void;
}> = ({
  children,
  className = '',
  spotlightColor = 'rgba(217, 240, 120, 0.18)',
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Moving Spotlight Glow */}
      <motion.div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: useTransform(
            [mouseX, mouseY],
            ([x, y]) =>
              `radial-gradient(350px circle at ${x}px ${y}px, ${spotlightColor}, transparent 80%)`
          ),
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

/**
 * 3D Tilt Card inspired by ReactBits
 * Uses spring physics to subtly angle the card based on mouse offset.
 */
export const TiltCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  maxAngle?: number;
}> = ({ children, className = '', maxAngle = 8 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 250, damping: 25 });
  const mouseYSpring = useSpring(y, { stiffness: 250, damping: 25 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [maxAngle, -maxAngle]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-maxAngle, maxAngle]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      className={`transition-shadow duration-300 ${className}`}
    >
      <div style={{ transform: 'translateZ(15px)' }}>{children}</div>
    </motion.div>
  );
};

/**
 * Wispr Flow signature Acoustic / Knowledge Pulse Waveform
 * Dynamic animated equalizer bars that simulate real-time thinking/speech.
 */
export const WaveformVisualizer: React.FC<{
  active?: boolean;
  color?: string;
  barCount?: number;
}> = ({ active = true, color = '#d9f078', barCount = 10 }) => {
  return (
    <div className="inline-flex items-center space-x-1 h-5 px-1.5 py-0.5 rounded-full bg-black/20">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.span
          key={i}
          animate={
            active
              ? {
                  height: [
                    `${4 + (i % 4) * 3}px`,
                    `${14 + ((i * 3) % 7) * 2}px`,
                    `${6 + (i % 3) * 2}px`,
                  ],
                }
              : { height: '4px' }
          }
          transition={{
            repeat: Infinity,
            repeatType: 'reverse',
            duration: 0.6 + (i % 5) * 0.15,
            ease: 'easeInOut',
          }}
          style={{ backgroundColor: color }}
          className="w-1 rounded-full shrink-0"
        />
      ))}
    </div>
  );
};

/**
 * Animated Highlighter Marker Stroke (Motion-Primitives)
 * Draws a fluid marker highlight stroke under key phrases when rendered.
 */
export const HighlighterStroke: React.FC<{
  children: React.ReactNode;
  color?: string;
  className?: string;
}> = ({ children, color = '#d9f078', className = '' }) => {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <motion.span
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        style={{
          backgroundColor: color,
          transformOrigin: 'left center',
        }}
        className="absolute left-0 bottom-1 w-full h-[35%] -z-0 rounded-sm opacity-85"
      />
    </span>
  );
};

/**
 * MagneticButton with spring bounce physics (Motion.dev)
 */
export const MagneticButton: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97, y: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.button>
  );
};
