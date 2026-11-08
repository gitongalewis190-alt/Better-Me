const PROMPTS = [
  'What did you do today that your future self will thank you for?',
  'Which task did you avoid, and what was the real reason?',
  'Where did your energy spike today, and what was happening right before?',
  'If today were a chapter, what would its title be?',
  'What did you learn about yourself today that surprised you?',
  'Which small win deserves more credit than you gave it?',
  'What would you do differently if you planned tomorrow with today\'s energy?',
  'Who helped you move forward today, even a little?',
  'What drained you today, and can you remove or shrink it?',
  'What idea came to you today that you have not written down yet?',
  'What did you say no to, and was it the right call?',
  'Where did you rush, and what did rushing cost you?',
  'What do you understand better today than you did yesterday?',
  'Which task felt like a job for your future self?',
  'If your study session were a conversation, what did it tell you?',
  'What did you admire in someone today that you want to build in yourself?',
  'Which habit helped you today, and which one quietly hurt?',
  'What would make tomorrow feel like a good day before it even starts?',
  'Describe your focus today in one honest sentence.',
  'What did boredom teach you today?',
  'Where did you feel most like yourself?',
  'What would you tell a friend who had today\'s list?',
  'What uncomfortable thing did you do, even briefly?',
  'What did your body tell you today that your plan ignored?',
  'Which money or business step moved forward, however slightly?',
  'What question is still open in your mind?',
  'What did you finish that you almost quit?',
  'If you could redo one hour today, which would it be and why?',
  'What did you give attention to today that deserved less?',
  'What are you proud of that nobody asked you about?'
];

export function promptFor(key) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROMPTS[h % PROMPTS.length];
}
