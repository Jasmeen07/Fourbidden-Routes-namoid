import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: string;
  isRevoked?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ expiresAt, isRevoked }) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalSeconds: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
  });

  useEffect(() => {
    const calculateTime = () => {
      if (isRevoked) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
        return;
      }

      const expiry = new Date(expiresAt).getTime();
      const now = new Date().getTime();
      const diffMs = expiry - now;

      if (diffMs <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft({ hours, minutes, seconds, totalSeconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, isRevoked]);

  if (isRevoked) {
    return (
      <span className="badge badge-revoked">
        REVOKED
      </span>
    );
  }

  if (timeLeft.totalSeconds <= 0) {
    return (
      <span className="badge badge-expired">
        EXPIRED
      </span>
    );
  }

  const formatDigits = (n: number) => n.toString().padStart(2, '0');

  // If less than 1 hour, highlight in amber/rose
  const isUrgent = timeLeft.totalSeconds < 3600;

  return (
    <span
      className={`badge badge-active countdown-pulse font-mono ${isUrgent ? 'badge-tier-sensitive' : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
    >
      <Clock size={13} />
      <span>
        {formatDigits(timeLeft.hours)}:{formatDigits(timeLeft.minutes)}:{formatDigits(timeLeft.seconds)}
      </span>
    </span>
  );
};
