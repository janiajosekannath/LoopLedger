import React from 'react';

const Timeline = ({ events = [] }) => {
  if (!events.length) return <p className="text-sm text-gray-400">No history yet.</p>;

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, i) => (
          <li key={i}>
            <div className="relative pb-8">
              {i !== events.length - 1 && (
                <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
              )}
              <div className="relative flex space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 ring-8 ring-white">
                  <span className="text-xs font-bold text-indigo-600">
                    {(event.to || event.type || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm text-gray-800">
                      {event.from ? (
                        <>
                          Status changed from <span className="font-medium capitalize">{event.from}</span> to{' '}
                          <span className="font-medium capitalize">{event.to}</span>
                        </>
                      ) : (
                        <span className="font-medium capitalize">{event.to || event.note}</span>
                      )}
                    </p>
                    {event.note && event.from && (
                      <p className="text-xs text-gray-400 mt-0.5">{event.note}</p>
                    )}
                  </div>
                  <div className="whitespace-nowrap text-right text-xs text-gray-400">
                    <time>{event.at ? new Date(event.at).toLocaleString('en-IN') : ''}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Timeline;
