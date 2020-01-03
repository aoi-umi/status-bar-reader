import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

let myStatusBarItem: vscode.StatusBarItem;

export function activate({ subscriptions }: vscode.ExtensionContext) {
	const name = 'statusBarReader';
	const next = `${name}.next`;
	const prev = `${name}.prev`;
	const nextLine = `${name}.nextLine`;
	const prevLine = `${name}.prevLine`;


	subscriptions.push(vscode.commands.registerCommand(next, () => {
		Reader.next();
	}));
	subscriptions.push(vscode.commands.registerCommand(nextLine, () => {
		Reader.next(true);
	}));
	subscriptions.push(vscode.commands.registerCommand(prev, () => {
		Reader.prev();
	}));
	subscriptions.push(vscode.commands.registerCommand(prevLine, () => {
		Reader.prev(true);
	}));

	// create a new status bar item that we can now manage
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	myStatusBarItem.command = next;
	subscriptions.push(myStatusBarItem);

	// register some listener that make sure the status bar 
	// item always up-to-date
	// subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem));
	// subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem));

	myStatusBarItem.show();
	Reader.init();
}

const BookStatus = {
	start: 0,
	reading: 1,
	end: 2
};
class Reader {
	static textLength = 20;
	static rl: readline.Interface;
	static lines: string[] = [];
	static currLine = 0;
	static resume = true;
	static idx = 0;
	static currText = '';
	static bookStatus = BookStatus.start;
	static init() {
		Reader.updateText('init');
		let dirPath = path.join(__dirname, '../book');
		let files = fs.readdirSync(dirPath);
		let file = files[0];

		Reader.updateText('init finished');
		if (!file) {
			Reader.updateText('no book');
			return;
		}
		Reader.updateText('loading book');
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

	static updateText(text: string) {
		myStatusBarItem.text = text;
	}

	static handleLine(line: string) {
		this.rl.pause();
		this.lines.push(line);
	}

	static readData() {
		this.rl.resume();
	}

	static setText() {
		let text = this.lines[this.currLine];
		this.currText = text.substr(this.idx, this.textLength);
		this.updateText(this.currText);
		this.bookStatus = BookStatus.reading;
	}

	static clear() {
		this.idx = 0;
		this.currText = '';
	}

	static next(line?: boolean) {
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

	static prev(line?: boolean) {
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
