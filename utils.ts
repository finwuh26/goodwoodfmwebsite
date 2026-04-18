export const formatDate = (dateValue: any) => {
    if (!dateValue) return 'Recently';
    if (dateValue.toDate) {
        return dateValue.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (typeof dateValue === 'string') {
        return dateValue.split('T')[0];
    }
    return 'Recently';
};

export const getDatesForThisWeek = (weekOffset: number = 0) => {
    const now = new Date();
    // 0 is Sunday, 1 is Monday. We want Monday as the first day of the week.
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        // Reset hours/mins/secs to start of day for easier comparison
        d.setHours(0, 0, 0, 0); 
        d.setDate(now.getDate() + diffToMonday + i + (weekOffset * 7));
        dates.push({
            dateObj: d,
            dayString: d.toLocaleDateString('en-US', { weekday: 'long' }),
            formattedString: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        });
    }
    return dates;
};
