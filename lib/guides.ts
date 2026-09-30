// Scene guides: good ways into, through and out of each conversation, with a line to try.
// Written per scene against the persona's bio and the engagement rules in lib/engagement.ts, so
// the example lines score the way the tips promise. Icons are OpenMoji code points (public/emoji/).

export interface GuideTip {
  emoji: string;
  title: string;
  detail: string;
  /** Something you could say out loud to this persona. */
  line: string;
}

export interface Guide {
  openers: GuideTip[];
  during: GuideTip[];
  exits: GuideTip[];
}

export const GUIDES: Record<string, Guide> = {
  cafe: {
    openers: [
      {
        emoji: "2615",
        title: "Order, then ask back",
        detail: "Your order ticks the first goal, and a quick question back tells Jess you're up for a chat.",
        line: "Hi, could I get a flat white, please? How's your morning been so far?",
      },
      {
        emoji: "1F914",
        title: "Ask for her pick",
        detail: "Baristas like being asked what's good, and naming two drinks still counts as your order.",
        line: "Morning. What's your favorite drink here? I'm torn between a latte and a cortado.",
      },
      {
        emoji: "1F3F7",
        title: "Name for the cup",
        detail: "When she asks your name for the cup, give it and add one easy question so it doesn't stop there.",
        line: "It's Alex. Is it always this quiet in here on a Tuesday morning?",
      },
    ],
    during: [
      {
        emoji: "1FA9D",
        title: "Leave her a hook",
        detail: "When she asks about your plans, name one concrete thing she can pick up on, then hand the question back to her.",
        line: "I'm off to the library to finish a job application. Got anything fun planned after your shift?",
      },
      {
        emoji: "1F338",
        title: "Catch what she mentions",
        detail:
          "If she mentions something of her own, like a trip she's saving for, asking about that exact thing is the best follow-up there is.",
        line: "Japan in the spring? Are you going for the cherry blossoms?",
      },
      {
        emoji: "1F95B",
        title: "Play along with her humor",
        detail: "She has a dry sense of humor, so a light, curious question about the menu gives her room to joke.",
        line: "Honestly, is oat milk actually any good, or is that just what everyone orders now?",
      },
    ],
    exits: [
      {
        emoji: "1F60A",
        title: "Thank her by name",
        detail: "When she hands over the drink, a thank-you with her name and a warm wish closes things neatly.",
        line: "Thank you, Jess. Enjoy the rest of your shift, and have a great day.",
      },
      {
        emoji: "1F45F",
        title: "Call back a detail",
        detail:
          "If she told you something about herself, like a race she's training for, bringing it up on your way out shows you were listening.",
        line: "Thanks, this smells amazing. Hope the knees hold up with the training, see you later.",
      },
      {
        emoji: "1F44B",
        title: "Say you'll be back",
        detail: "Mentioning your next visit makes the goodbye easy and leaves a door open for another chat.",
        line: "Cheers, Jess. I'll be back next Tuesday, so take care till then.",
      },
    ],
  },
  coworker: {
    openers: [
      {
        emoji: "2615",
        title: "Play along with the machine",
        detail: "He opens with a joke about the coffee machine, so joke back about yourself and ask him something to get past hello.",
        line: "It's not just you. I pressed every button twice. How long have you been waiting?",
      },
      {
        emoji: "1F91D",
        title: "Finally swap names",
        detail: "You've only ever said hi, so admit it lightly and ask. Most people are relieved you said it first.",
        line: "Morning. I realize we've said hi for ages, but I don't know your name?",
      },
      {
        emoji: "1F3D6",
        title: "Go straight to the weekend",
        detail: "On a Monday morning the weekend is the easiest question to ask, and it's the first goal on your list.",
        line: "It still works, you just have to be patient. How was your weekend, anything good?",
      },
    ],
    during: [
      {
        emoji: "1F971",
        title: "Match his tired humor",
        detail: "He's a bit tired and pokes fun at himself, so keep it light and give him an easy way to tell you why.",
        line: "Ha, same energy here. Did something wear you out, or is it just Monday?",
      },
      {
        emoji: "1F35C",
        title: "Share one small detail",
        detail: "Give him one concrete thing from your own weekend in a sentence or two, then hand the turn back so it stays a chat.",
        line: "Mine was quiet. I finally tried the ramen place near me, so good. Do you like ramen?",
      },
      {
        emoji: "26BD",
        title: "Say it when you overlap",
        detail: "If something he mentions really matches your life, even loosely, say so out loud and then ask one more thing about it.",
        line: "No way, I play football too. Is the Wednesday game a work thing, or friends?",
      },
    ],
    exits: [
      {
        emoji: "1F4BC",
        title: "Let the coffee end it",
        detail: "When his cup is ready and he says he's off to a meeting, wish him luck, by name if you swapped names. It's a warm, easy way out.",
        line: "Looks like your coffee's done. Good luck in your meeting, Marcus. Talk to you later.",
      },
      {
        emoji: "1F575",
        title: "Call back to a detail",
        detail: "Mention one thing he told you earlier, like the show he's hooked on. It shows you were listening.",
        line: "Enjoy the next episode tonight, no spoilers from me. Have a good day.",
      },
      {
        emoji: "1F4C6",
        title: "Leave the door open",
        detail: "You'll run into him at the machine again, so a light nod to next time makes the next hello easier.",
        line: "Nice chatting with you. Same time next Monday? See you around.",
      },
    ],
  },
  party: {
    openers: [
      {
        emoji: "1F3D3",
        title: "Answer, then ask back",
        detail:
          "She opens by asking how you know Maya, so a real answer followed by the same question hands the conversation straight back to her.",
        line: "I know Maya from college, actually. What about you, how do you two know each other?",
      },
      {
        emoji: "1F954",
        title: "Join the chips joke",
        detail:
          "Laughing along with her snack comment is an easy way in, and admitting you've done the same already counts as your first bit of common ground.",
        line: "Haha, same here, I keep going back for more. I know Maya from work. What about you?",
      },
      {
        emoji: "1F4DB",
        title: "Swap names early",
        detail: "She won't offer her name unless you ask, and giving yours first makes asking for hers feel natural.",
        line: "I know Maya through a friend, actually. I'm Alex, by the way. What's your name?",
      },
    ],
    during: [
      {
        emoji: "1F9D7",
        title: "Pick up the climbing gym",
        detail:
          "If she says she knows Maya from climbing, asking about that exact detail shows you were listening, and that warms her up faster than a new topic.",
        line: "The climbing gym? That's cool. How long have you been climbing?",
      },
      {
        emoji: "1F9E9",
        title: "Say the overlap out loud",
        detail:
          "If she mentions moving here from Portland and you're fairly new in town too, say so plainly, then ask about her side of it.",
        line: "No way, I moved here last year too. What do you miss most about Portland?",
      },
      {
        emoji: "1F399",
        title: "Get curious about her work",
        detail:
          "If she mentions editing podcasts, a specific question about it, with her name in it, is the kind of real curiosity that softens her sarcasm.",
        line: "Editing podcasts sounds fascinating. Do you ever get to pick the shows you work on?",
      },
    ],
    exits: [
      {
        emoji: "1F3B6",
        title: "Leave on a high note",
        detail:
          "Heading off right after a laugh or a good story ends things warmly, instead of waiting for the conversation to fizzle into silence.",
        line: "Haha, okay, that's a great story. I should go find Maya, but it was really nice meeting you, Sam.",
      },
      {
        emoji: "1F415",
        title: "Call back a detail",
        detail: "Mentioning something she told you, like her dog Pixel, shows you were listening right to the end.",
        line: "Nice meeting you, Sam. Give Pixel a scratch from me, and enjoy the rest of the party.",
      },
      {
        emoji: "1F6AA",
        title: "Leave the door open",
        detail:
          "Stepping away in the middle of a topic she enjoys, like her hiking trip, tells her you'd happily pick it up again later tonight.",
        line: "I'm gonna grab a drink, but I want to hear how the rest of that hike went. Catch you later?",
      },
    ],
  },
  networking: {
    openers: [
      {
        emoji: "1F3A4",
        title: "Start with the talks",
        detail:
          "You both just sat through the same talks, so asking about them is an easy question with no pressure behind it, and a dry answer is still an answer.",
        line: "Evening. Which of the talks tonight was actually worth staying for?",
      },
      {
        emoji: "1F605",
        title: "Admit it's a bit awkward",
        detail:
          "Owning your own nerves takes the pressure off him, and asking why he came often gets a more honest answer than the usual small talk.",
        line: "Hi. I'm honestly not great at these events. What brings you here tonight?",
      },
      {
        emoji: "1F4DB",
        title: "Ask his name early",
        detail: "Once you have his name you can use it later, which warms him up, and asking what he works on ticks off your first goal.",
        line: "Hi, I don't think we've met. What's your name, and what are you working on these days?",
      },
    ],
    during: [
      {
        emoji: "1F6A2",
        title: "Ask about a bad day",
        detail:
          "Asking what goes wrong gets you a story instead of a job title, and reusing the word he just gave you counts as a follow-up.",
        line: "Software for ports? What actually goes wrong at a port on a bad day?",
      },
      {
        emoji: "1F4CA",
        title: "Stay with his story",
        detail:
          "If he mentions a win, like the ship he rerouted, asking how it happened can get you the longer answer you need, and a warm reaction plus his name helps too.",
        line: "No way, one spreadsheet error moved a whole ship? How did you even catch that, Daniel?",
      },
      {
        emoji: "1F6B2",
        title: "Give a little back",
        detail:
          "He won't ask you much at first, so if he mentions a hobby like old bikes, share a small honest detail before your next question so it doesn't feel like an interview.",
        line: "I've always wanted to restore an old bike, but I'd have no clue. What was your first one?",
      },
    ],
    exits: [
      {
        emoji: "2615",
        title: "Suggest coffee sometime",
        detail:
          "Tying the coffee to something he enjoyed talking about gives you both a reason to meet again, and it still counts as a warm goodbye.",
        line: "Great talking to you. Want to grab a coffee sometime? I'd love to hear more about the ports.",
      },
      {
        emoji: "1F44B",
        title: "Leave with a reason",
        detail:
          "A simple reason, a quick ask for his card and a warm goodbye let you leave cleanly, without it feeling like you're escaping.",
        line: "I should find my colleague before she leaves. Could I grab your card? Really nice meeting you, Daniel.",
      },
      {
        emoji: "1F4F1",
        title: "Thank him and connect",
        detail: "Thank him, ask how to stay in touch and wish him a good evening, so the next step and the goodbye come together.",
        line: "Thanks, Daniel, this was the best chat of my night. Can I find you on LinkedIn? Have a good evening.",
      },
    ],
  },
  "first-date": {
    openers: [
      {
        emoji: "1F606",
        title: "Play along with the joke",
        detail:
          "They open with a nervous little joke, so laugh along and reuse their own words, which counts as picking up on what they said.",
        line: "Haha, same here. I nearly waved at a total stranger by the door. How was your day?",
      },
      {
        emoji: "1F605",
        title: "Admit the nerves",
        detail:
          "Most people are nervous on a first date, so naming it lightly takes the pressure off you both and gives them room to admit it too.",
        line: "I'll be honest, I'm a little nervous. Is that normal, or is it just me?",
      },
      {
        emoji: "1F942",
        title: "Start from the wine bar",
        detail:
          "The place you're sitting in is an easy first topic, and asking for their help gets them talking without it feeling like an interview.",
        line: "Is this your kind of place? I know nothing about wine, so I might need your help.",
      },
    ],
    during: [
      {
        emoji: "1F9D0",
        title: "Ask for the story",
        detail:
          "When they joke about something they're bad at, ask what happened and reuse their own word for it, so it lands as a real follow-up.",
        line: "Wait, you're terrible at it? Okay, I need to hear what happened the first time.",
      },
      {
        emoji: "1F35D",
        title: "Tell it, then hand back",
        detail: "Keep your own story to about half a minute with one funny detail, then end on a question so they get the next turn.",
        line: "That reminds me of the first time I cooked for friends. I forgot the salt and they ate it all out of politeness. What's your worst kitchen moment?",
      },
      {
        emoji: "1F91D",
        title: "Say it when you click",
        detail: "When something they love is something you love too, say so out loud and ask how they got into it.",
        line: "No way, I love that too. What got you into it?",
      },
    ],
    exits: [
      {
        emoji: "1F31F",
        title: "Name what you enjoyed",
        detail: "One short, honest line about the evening lands better than a big speech and leaves them feeling good about the date.",
        line: "Honestly, I had a really fun night. I laughed way more than I expected. So good meeting you.",
      },
      {
        emoji: "1F6AA",
        title: "Leave the door open",
        detail: "If you'd like a second date, say so simply and give them an easy way to say yes.",
        line: "I'd like to do this again. Want to pick the place next time? Talk soon.",
      },
      {
        emoji: "1F319",
        title: "Wrap up with a callback",
        detail: "Give a reason to head home and bring back one thing they told you, which shows you were listening right to the end.",
        line: "I should head home, I've got an early start. I want an update on that terrible hobby, though. Have a lovely night.",
      },
    ],
  },
  "ask-out": {
    openers: [
      {
        emoji: "1F4D6",
        title: "Answer, then ask back",
        detail:
          "They open with a question about reading the ending first, so a quick honest answer and a question about their book keeps them talking about something they clearly enjoy.",
        line: "Haha, no, I'm way too scared of spoilers. What's the book about?",
      },
      {
        emoji: "1F602",
        title: "Join in on the laugh",
        detail:
          "If they're laughing at their book, say you love books that do that and ask which part got them, so they get to tell the story.",
        line: "I haven't, but I love it when a book makes you laugh out loud. Which part got you?",
      },
      {
        emoji: "1F4DB",
        title: "Swap names early",
        detail:
          "You've been chatting for a few minutes without names, and once you know theirs you can use it later, which makes the conversation feel warmer.",
        line: "We've been chatting all this time and I never asked your name. What is it?",
      },
    ],
    during: [
      {
        emoji: "1F50D",
        title: "Catch the small detail",
        detail:
          "They'll drop little things, like having moved here last year, and asking about exactly that shows you're really listening.",
        line: "Wait, you moved here last year? How are you finding it so far?",
      },
      {
        emoji: "1F517",
        title: "Say the me too",
        detail:
          "When something clicks, like a soft spot for bad puns, say it out loud, because a shared interest is one of your goals and it gives you something natural to invite them to later.",
        line: "No way, I love bad puns too. What's the worst one you know?",
      },
      {
        emoji: "1F5FA",
        title: "Ask what they do for fun",
        detail: "Asking about life outside the book brings out their hobbies, and those give you a specific idea for where to go together.",
        line: "What do you usually do for fun around here? I'm always looking for new places to try.",
      },
    ],
    exits: [
      {
        emoji: "2615",
        title: "Build the ask on common ground",
        detail: "Tying the invite to the thing you both liked makes it feel like the natural next step instead of a jump out of nowhere.",
        line: "Since we both love bad puns, would you like to grab coffee sometime and trade the worst ones?",
      },
      {
        emoji: "1F4F1",
        title: "If yes, make it real",
        detail:
          "If they say yes or suggest a place, go with their idea, swap numbers and keep it light instead of planning every detail at the table.",
        line: "That sounds great. Can I get your number so we can pick a day? See you soon.",
      },
      {
        emoji: "1F44B",
        title: "If no, leave warmly",
        detail: "Keep it short: thank them, say one kind thing about the chat and say goodbye, without asking why or trying again.",
        line: "No worries at all, thanks for being honest. It was really nice chatting with you. Enjoy the book.",
      },
    ],
  },
  stage: {
    openers: [
      {
        emoji: "1F32C",
        title: "Take the breath",
        detail:
          "The clock only starts once you speak, so take the breath Priya offers, thank her, and say the topic back to give yourself a calm second.",
        line: "Thanks, Priya. Okay, the most underrated invention. I'm going with the humble zipper.",
      },
      {
        emoji: "1F5FA",
        title: "Tell them the plan",
        detail:
          "Saying the shape of your talk up front tells your own brain where to go next, and the room relaxes because they know where you're headed.",
        line: "I'll give you one reason and one story, and the story is the fun part.",
      },
      {
        emoji: "1F4D6",
        title: "Start with a moment",
        detail: "A small real story needs no notes, so the words start coming before the nerves catch up.",
        line: "Last winter my train broke down for two hours, and that's where this talk starts.",
      },
    ],
    during: [
      {
        emoji: "1F50D",
        title: "Zoom into the details",
        detail:
          "Stretch your one example with small specifics like a smell, a place, or what someone said, and it can fill half a minute on its own.",
        line: "Here's what I mean. My grandmother made one soup, and the whole flat smelled of it.",
      },
      {
        emoji: "1F309",
        title: "Bridge instead of freezing",
        detail:
          "A short pause is fine, but attention starts to slip after about three seconds of silence, and every um costs a little too, so keep one bridge line ready.",
        line: "So that's my reason. Now let me tell you how I found out.",
      },
      {
        emoji: "1F64B",
        title: "Bring the room in",
        detail:
          "Ask the audience something they only answer in their heads, then answer it yourself right away, and you have your next thirty seconds.",
        line: "Think about the last time you were really bored. For me, it was a train platform.",
      },
    ],
    exits: [
      {
        emoji: "1F6EC",
        title: "Land it in one line",
        detail:
          "Once you're past a minute, say your main point again in one sentence, say thank you, and press I'm done so Priya can start the questions.",
        line: "So that's my case: everyone should learn one great meal. Thank you.",
      },
      {
        emoji: "1F3D3",
        title: "Echo, answer, stop",
        detail:
          "Pick up a word from Priya's question, give your answer and one reason in a sentence or two, then stop, and take a quiet pause where you'd normally say um.",
        line: "Fair question about the cost. I think it pays off, because local shops get more foot traffic.",
      },
      {
        emoji: "1F937",
        title: "Not sure is fine",
        detail:
          "Her questions are meant to make you think, so an honest best guess sounds more confident than a dodge, and after your second answer Priya wraps up the evening for you.",
        line: "I honestly don't know the numbers, but my best guess is most people would adapt within a year.",
      },
    ],
  },
};
