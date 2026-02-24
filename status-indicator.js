const spinner = ['⠋', '⠙', '⠚', '⠒', '⠑', '⠲', '⠴', '⠦', '⠧', '⠇', '⠏'];
let index = 0;

setInterval(() => {
    process.stdout.write(`\r${spinner[index % spinner.length]} Loading VRM model...`);
    index++;
}, 100);