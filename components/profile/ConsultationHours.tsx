import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

type ConsultationHoursProps = {
  hours: Record<string, string>;
};

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

export function ConsultationHours({ hours }: ConsultationHoursProps) {
  // Sort entries by day order, skip days not present
  const sortedDays = DAY_ORDER.filter((day) => day in hours);

  if (sortedDays.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-blue-800" />
          <h2 className="text-lg font-semibold text-gray-900">Consultation Hours</h2>
        </div>
        <div className="space-y-2">
          {sortedDays.map((day) => (
            <div
              key={day}
              className="flex justify-between items-center py-2 px-3 rounded-md odd:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                {DAY_LABELS[day] ?? day}
              </span>
              <span className="text-sm text-gray-600">{hours[day]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
