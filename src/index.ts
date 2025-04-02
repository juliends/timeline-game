import { instrument } from "@fiberplane/hono-otel";
import { createFiberplane, createOpenAPISpec } from "@fiberplane/hono";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import * as schema from "./db/schema";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Honc App</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 min-h-screen flex flex-col items-center justify-center">
      <div class="max-w-md w-full bg-white shadow-md rounded-lg p-6">
        <h1 class="text-2xl font-bold text-center mb-6">Honc from above! ☁️🪿</h1>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 class="text-xl font-semibold mb-2">Timeline Game</h2>
          <p class="text-gray-700 mb-4">Test your knowledge of 20th century history with our interactive timeline game!</p>
          <div class="text-center">
            <a href="/game" class="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Play Now</a>
          </div>
        </div>
        
        <div class="text-center text-gray-500 text-sm">
          <p>Built with Hono on Cloudflare Workers</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Route for the game
app.get("/game", (c) => {
  return c.html(
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Timeline Game</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body>
      <div id="root"></div>
      <script type="module">
        import React from 'https://esm.sh/react@18.2.0';
        import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
        
        // Timeline Game Component
        const TimelineGame = () => {
          // List of 20th century events with their dates
          const eventsData = [
            { id: 1, event: "World War I begins", year: 1914 },
            { id: 2, event: "Russian Revolution", year: 1917 },
            { id: 3, event: "Wall Street Crash", year: 1929 },
            { id: 4, event: "World War II begins", year: 1939 },
            { id: 5, event: "First atomic bomb dropped on Hiroshima", year: 1945 },
            { id: 6, event: "NASA founded", year: 1958 },
            { id: 7, event: "First human lands on the moon", year: 1969 },
            { id: 8, event: "Fall of the Berlin Wall", year: 1989 },
            { id: 9, event: "World Wide Web invented", year: 1991 },
            { id: 10, event: "Dissolution of the Soviet Union", year: 1991 }
          ];
        
          // Game state
          const [displayedEvents, setDisplayedEvents] = React.useState([]);
          const [currentEvent, setCurrentEvent] = React.useState(null);
          const [selectedPosition, setSelectedPosition] = React.useState(null);
          const [feedback, setFeedback] = React.useState('');
          const [score, setScore] = React.useState(0);
          const [gameOver, setGameOver] = React.useState(false);
          const [round, setRound] = React.useState(0);
        
          // Initialize game
          React.useEffect(() => {
            startNewRound();
          }, []);
        
          // Start a new round
          const startNewRound = () => {
            // Reset feedback
            setFeedback('');
            setSelectedPosition(null);
            
            // Get remaining events
            const remainingEvents = eventsData.filter(
              event => !displayedEvents.some(e => e.id === event.id) && 
                        (currentEvent?.id !== event.id)
            );
            
            // Check if game is over
            if (remainingEvents.length === 0) {
              setGameOver(true);
              return;
            }
        
            // Randomly select 4-5 events to display if this is the first round or we need more events
            if (displayedEvents.length < 4) {
              const initialEvents = [...displayedEvents];
              const availableEvents = eventsData.filter(
                event => !initialEvents.some(e => e.id === event.id)
              );
              
              while (initialEvents.length < 4 && availableEvents.length > 1) {
                const randomIndex = Math.floor(Math.random() * availableEvents.length);
                initialEvents.push(availableEvents[randomIndex]);
                availableEvents.splice(randomIndex, 1);
              }
              
              // Sort displayed events by year
              initialEvents.sort((a, b) => a.year - b.year);
              setDisplayedEvents(initialEvents);
              
              // Choose current event
              const randomIndex = Math.floor(Math.random() * availableEvents.length);
              setCurrentEvent(availableEvents[randomIndex]);
            } else {
              // Just pick a new current event
              const randomIndex = Math.floor(Math.random() * remainingEvents.length);
              setCurrentEvent(remainingEvents[randomIndex]);
            }
        
            setRound(prevRound => prevRound + 1);
          };
        
          // Check user answer
          const checkAnswer = () => {
            if (selectedPosition === null) {
              setFeedback('Please select a position for the event first!');
              return;
            }
        
            // Get the years before and after the selected position
            const sortedEvents = [...displayedEvents];
            const targetYear = currentEvent.year;
            
            let isCorrect = false;
            
            if (selectedPosition === 0) {
              // At the beginning
              isCorrect = targetYear <= sortedEvents[0].year;
            } else if (selectedPosition === sortedEvents.length) {
              // At the end
              isCorrect = targetYear >= sortedEvents[sortedEvents.length - 1].year;
            } else {
              // In between
              isCorrect = 
                targetYear >= sortedEvents[selectedPosition - 1].year && 
                targetYear <= sortedEvents[selectedPosition].year;
            }
            
            // Add event to timeline at the correct position
            const newDisplayedEvents = [...sortedEvents];
            newDisplayedEvents.splice(
              // Find correct position based on year
              newDisplayedEvents.findIndex(e => e.year > targetYear), 
              0, 
              currentEvent
            );
            
            setDisplayedEvents(newDisplayedEvents);
            
            if (isCorrect) {
              setFeedback(\`Correct! \${currentEvent.event} happened in \${currentEvent.year}.\`);
              setScore(prevScore => prevScore + 1);
            } else {
              setFeedback(\`Incorrect. \${currentEvent.event} happened in \${currentEvent.year}.\`);
            }
            
            // Start new round after a delay
            setTimeout(() => {
              startNewRound();
            }, 2000);
          };
        
          // Update the renderPositionSelectors function
          const renderPositionSelectors = () => {
            const selectors = [];
            const sortedEvents = [...displayedEvents];
            
            // Add first position selector
            selectors.push(
              React.createElement("div", { key: "pos-0", className: "flex justify-center mt-2" },
                React.createElement("button", {
                  onClick: () => setSelectedPosition(0),
                  className: \`px-3 py-1 rounded-full \${selectedPosition === 0 ? 'bg-blue-500 text-white' : 'bg-gray-200'}\`
                }, \`Before 1\`)
              )
            );
            
            // Add remaining selectors after each event
            sortedEvents.forEach((_, index) => {
              const isLastElement = index === sortedEvents.length - 1;
              selectors.push(
                React.createElement("div", { key: \`pos-\${index + 1}\`, className: "flex justify-center mt-2" },
                  React.createElement("button", {
                    onClick: () => setSelectedPosition(index + 1),
                    className: \`px-3 py-1 rounded-full \${selectedPosition === index + 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'}\`
                  }, \`\${isLastElement ? \`After \${index + 1}\` : \`Before \${index + 2}\`}\`)
                )
              );
            });
            
            return selectors;
          };
        
          return React.createElement("div", { className: "max-w-3xl mx-auto p-4 bg-gray-50 rounded-lg shadow-lg" },
            React.createElement("h1", { className: "text-2xl font-bold text-center mb-4" }, "20th Century Timeline Game"),
            React.createElement("div", { className: "mb-4 text-center" },
              React.createElement("p", { className: "text-lg" }, \`Round: \${round} | Score: \${score}\`)
            ),
        
            gameOver ? 
              React.createElement("div", { className: "text-center p-6 bg-blue-100 rounded-lg" },
                React.createElement("h2", { className: "text-xl font-bold mb-2" }, "Game Over!"),
                React.createElement("p", { className: "mb-4" }, \`Your final score: \${score} out of \${eventsData.length}\`),
                React.createElement("button", {
                  onClick: () => {
                    setDisplayedEvents([]);
                    setCurrentEvent(null);
                    setScore(0);
                    setGameOver(false);
                    setRound(0);
                    startNewRound();
                  },
                  className: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                }, "Play Again")
              ) : 
              React.createElement(React.Fragment, null,
                React.createElement("div", { className: "mb-6 bg-white p-4 rounded-lg shadow" },
                  React.createElement("h2", { className: "text-lg font-semibold mb-2" }, "Timeline:"),
                  React.createElement("div", { className: "relative" },
                    React.createElement("div", { className: "absolute left-8 top-0 bottom-0 w-1 bg-gray-300" }),
                    
                    React.createElement("div", { className: "space-y-4" },
                      displayedEvents.map((event, index) => 
                        React.createElement(React.Fragment, { key: event.id },
                          selectedPosition === index && currentEvent &&
                            React.createElement("div", { className: "ml-12 p-2 bg-yellow-100 rounded border border-yellow-300" },
                              React.createElement("span", { className: "font-bold" }, "???"), " ", currentEvent.event
                            ),
                          React.createElement("div", { className: "flex items-center" },
                            React.createElement("div", { className: "relative z-10" },
                              React.createElement("div", { className: "w-4 h-4 rounded-full bg-blue-500 ml-6" })
                            ),
                            React.createElement("div", { className: "ml-4 bg-blue-100 p-2 rounded flex-1" },
                              React.createElement("span", { className: "font-bold" }, event.year), ": ", event.event
                            )
                          )
                        )
                      ),
                      selectedPosition === displayedEvents.length && currentEvent &&
                        React.createElement("div", { className: "ml-12 p-2 bg-yellow-100 rounded border border-yellow-300" },
                          React.createElement("span", { className: "font-bold" }, "???"), " ", currentEvent.event
                        )
                    ),
                    
                    currentEvent && renderPositionSelectors()
                  )
                ),
        
                currentEvent &&
                  React.createElement("div", { className: "mb-6 bg-white p-4 rounded-lg shadow text-center" },
                    React.createElement("h2", { className: "text-lg font-semibold mb-2" }, "Place this event on the timeline:"),
                    React.createElement("div", { className: "p-3 bg-yellow-100 rounded-lg inline-block" },
                      React.createElement("p", { className: "text-xl font-medium" }, currentEvent.event),
                      React.createElement("p", { className: "text-sm text-gray-500" }, "(Year hidden)")
                    )
                  ),
        
                React.createElement("div", { className: "text-center" },
                  React.createElement("button", {
                    onClick: checkAnswer,
                    className: "px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  }, "Submit Answer")
                ),
        
                feedback &&
                  React.createElement("div", { 
                    className: \`mt-4 p-3 rounded-lg text-center \${feedback.startsWith('Correct') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}\`
                  }, feedback)
              )
          );
        };
        
        // Render the app
        const container = document.getElementById('root');
        const root = createRoot(container);
        root.render(React.createElement(TimelineGame));
      </script>
    </body>
    </html>`
  );
});

export default app;

// Export the instrumented app if you've wired up a Fiberplane-Hono-OpenTelemetry trace collector
//
// export default instrument(app);
