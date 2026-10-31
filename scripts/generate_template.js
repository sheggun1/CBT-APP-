const xlsx = require('xlsx');
const path = require('path');
const headers = ["Subject", "Question", "OptionA", "OptionB", "OptionC", "OptionD", "Answer", "Marks", "Topic", "Difficulty"];
const sample = [{ Subject: "Demo", Question: "2 + 2 = ?", OptionA: "1", OptionB: "4", OptionC: "3", OptionD: "5", Answer: "B", Marks: 1, Topic: "Math", Difficulty: "easy" }];
const ws = xlsx.utils.json_to_sheet(sample, { header: headers });
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, "Template");
xlsx.writeFile(wb, path.join(__dirname, '../data/question_template.xlsx'));
console.log("Template generated.");
