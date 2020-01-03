import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

let myStatusBarItem: vscode.StatusBarItem;

export function activate({ subscriptions }: vscode.ExtensionContext) {
	let reader = new Reader();
	const name = 'statusBarReader';
	const next = `${name}.next`;
	const prev = `${name}.prev`;
	const nextLine = `${name}.nextLine`;
	const prevLine = `${name}.prevLine`;

	subscriptions.push(vscode.commands.registerCommand(next, () => {
		reader.next();
	}));
	subscriptions.push(vscode.commands.registerCommand(nextLine, () => {
		reader.next(true);
	}));
	subscriptions.push(vscode.commands.registerCommand(prev, () => {
		reader.prev();
	}));
	subscriptions.push(vscode.commands.registerCommand(prevLine, () => {
		reader.prev(true);
	}));

	// create a new status bar item that we can now manage
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	myStatusBarItem.command = next;
	subscriptions.push(myStatusBarItem);

	myStatusBarItem.show();
	reader.init();
}

const BookStatus = {
	start: 0,
	reading: 1,
	end: 2
};
class Reader {
	textLength = 20;
	rl: readline.Interface;
	lines: string[] = [];
	currLine = 0;
	resume = true;
	idx = 0;
	currText = '';
	bookStatus = BookStatus.start;
	init() {
		this.updateText('init');
		let dirPath = path.join(__dirname, '../book');
		let files = fs.readdirSync(dirPath);
		let file = files[0];

		this.updateText('init finished');
		if (!file) {
			this.updateText('no book');
			return;
		}
		this.updateText('loading book');
		let readStream = fs.createReadStream(path.join(dirPath, file), {
			encoding: 'utf-8',
		});
		const rl = this.rl = readline.createInterface({
			input: readStream
		});
		rl.on('line', (chunk) => {
			this.handleLine(chunk);
			if (this.bookStatus === BookStatus.start)
				this.next();
		});
	}

	updateText(text: string) {
		myStatusBarItem.text = text;
	}

	handleLine(line: string) {
		this.rl.pause();
		this.lines.push(line);
	}

	readData() {
		this.rl.resume();
	}

	setText() {
		let text = this.lines[this.currLine];
		this.currText = text.substr(this.idx, this.textLength);
		this.updateText(this.currText);
		this.bookStatus = BookStatus.reading;
	}

	clear() {
		this.idx = 0;
		this.currText = '';
	}

	next(line?: boolean) {
		if (this.bookStatus === BookStatus.end)
			return;
		if (!this.rl)
			return;
		let lastLine = this.currLine >= this.lines.length - 1;
		let text = this.lines[this.currLine];
		let lastChar = !text || this.idx + this.currText.length >= text.length;

		let closed = (this.rl as any).closed;

		if (lastLine && lastChar) {
			if (closed) {
				this.updateText('### book end ###');
				this.clear();
				this.bookStatus = BookStatus.end;
				return;
			}
		}
		if (!closed && (this.currLine >= this.lines.length - 2))
			this.readData();

		this.idx = this.idx + this.currText.length
		if (line || this.idx + this.currText.length >= text.length) {
			if (this.bookStatus !== BookStatus.start)
				this.currLine++;
			this.clear();
		}
		this.setText();
	}

	prev(line?: boolean) {
		if (this.bookStatus === BookStatus.start)
			return;
		if (this.currLine === 0 && this.idx === 0) {
			this.updateText('### book start ###');
			this.clear();
			this.bookStatus = BookStatus.start;
			return;
		}
		let text = this.lines[this.currLine];
		if (line || this.idx === 0) {
			if (this.bookStatus !== BookStatus.end)
				this.currLine--;
			this.idx = 0;
			text = this.lines[this.currLine];
			if (!line && text.length > this.textLength)
				this.idx = text.length - this.textLength;
		} else {
			this.idx = this.idx - this.textLength;
			if (this.idx < 0)
				this.idx = 0;
		}
		this.setText();
	}
}
