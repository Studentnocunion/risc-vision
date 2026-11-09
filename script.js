
const codeInput = document.getElementById("code");
const stages = ["IF", "ID", "EX", "MEM", "WB"];

let registers = [];
let memory = [];
let instructions = [];
let pipeline = [null, null, null, null, null];
let pc = 0;
let cycle = 0;
let running = false;
let runTimer = null;
let stallCount = 0;
let completedInstructions = 0;

function initializeMachine() {
    registers = Array(32).fill(0);
    registers[2] = 10;
    registers[3] = 5;
    registers[5] = 3;

    memory = Array(64).fill(0);
    memory[10] = 20;

    pipeline = [null, null, null, null, null];
    pc = 0;
    cycle = 0;
    stallCount = 0;
completedInstructions = 0;
    events = [];
    finished = false;
}

function logEvent(message) {
    events.unshift(`Cycle ${cycle}: ${message}`);
    events = events.slice(0, 25);

    const log = document.getElementById("eventLog");
    log.innerHTML = "";

    events.forEach(message => {
        const entry = document.createElement("div");
        entry.className = "log-entry";
        entry.textContent = message;
        log.appendChild(entry);
    });
}
function updateMonitor(hazard, forwarding) {
    const hazardElement = document.getElementById("hazardStatus");

    hazardElement.textContent = hazard;
    hazardElement.classList.toggle(
        "hazard-active",
        hazard.toLowerCase().includes("hazard")
    );

    document.getElementById("forwardStatus").textContent = forwarding;
}

function parseInstruction(line) {
    const text = line.trim();
    const parts = text.replace(/,/g, " ").split(/\s+/);
    const op = parts[0].toUpperCase();

    function reg(value) {
        const match = value.match(/^R(\d+)$/i);

        if (!match || Number(match[1]) > 31) {
            throw new Error("Invalid register: " + value);
        }

        return Number(match[1]);
    }

    if (["ADD", "SUB", "AND", "OR", "XOR"].includes(op)) {
        if (parts.length !== 4) {
            throw new Error("Invalid instruction: " + text);
        }

        return {
            text, op,
            rd: reg(parts[1]),
            rs1: reg(parts[2]),
            rs2: reg(parts[3])
        };
    }

    if (op === "ADDI") {
        if (parts.length !== 4) {
            throw new Error("Invalid instruction: " + text);
        }

        const immediate = Number(parts[3]);

        if (!Number.isInteger(immediate)) {
            throw new Error("Invalid immediate: " + parts[3]);
        }

        return {
            text, op,
            rd: reg(parts[1]),
            rs1: reg(parts[2]),
            immediate
        };
    }

    if (op === "LW" || op === "SW") {
        if (parts.length !== 3) {
            throw new Error("Invalid memory instruction: " + text);
        }

        const match = parts[2].match(/^(-?\d+)\(R(\d+)\)$/i);

        if (!match) {
            throw new Error("Use memory format like 0(R2): " + text);
        }

        const base = Number(match[2]);

        if (base > 31) {
            throw new Error("Invalid base register: R" + base);
        }

        const offset = Number(match[1]);

        if (op === "LW") {
            return {
                text, op,
                rd: reg(parts[1]),
                rs1: base,
                offset
            };
        }

        return {
            text, op,
            rs1: base,
            rs2: reg(parts[1]),
            offset
        };
    }
if (op === "BEQ" || op === "BNE") {
    if (parts.length !== 4) {
        throw new Error("Invalid branch instruction: " + text);
    }

    const offset = Number(parts[3]);

    if (!Number.isInteger(offset)) {
        throw new Error("Invalid branch offset: " + parts[3]);
    }

    return {
        text, op,
        rs1: reg(parts[1]),
        rs2: reg(parts[2]),
        offset
    };
}
    throw new Error("Unsupported instruction: " + op);
}

function loadProgram() {
    stopRunning();

    try {
        instructions = codeInput.value
            .split("\n")
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#"))
            .map((line, index) => ({
    ...parseInstruction(line),
    index
}));

        initializeMachine();
        updateMonitor("No hazards detected.", "No forwarding yet.");
        document.getElementById("eventLog").innerHTML = "";
        document.getElementById("status").textContent =
            instructions.length ? "Program loaded. Ready!" : "No instructions loaded.";

        updateDisplay();
    } catch (error) {
        document.getElementById("status").textContent =
            "Error: " + error.message;
        throw error;
    }
}
function updatePerformance() {
    document.getElementById("totalCycles").textContent = cycle;

    document.getElementById("instructionCount").textContent =
        completedInstructions;

    document.getElementById("stallCount").textContent =
        stallCount;

    const cpi = completedInstructions > 0
        ? cycle / completedInstructions
        : 0;

    document.getElementById("cpi").textContent =
        cpi.toFixed(2);
}
function usesRegister(instruction, index) {
    if (!instruction || index === 0) return false;

    if (instruction.rs1 === index) return true;
    if (instruction.rs2 === index) return true;

    return false;
}

function getValue(index, currentMEM, currentWB, source) {
    if (index === 0) return 0;

    if (currentMEM && currentMEM.rd === index && currentMEM.rd !== 0) {
        const value = currentMEM.op === "LW"
            ? currentMEM.loadedValue
            : currentMEM.aluResult;

        if (value !== undefined) {
            logEvent(`MEM-to-EX forwarding: ${source} gets R${index} = ${value}`);
            return value;
        }
    }

    if (currentWB && currentWB.rd === index && currentWB.rd !== 0) {
        if (currentWB.writeValue !== undefined) {
            logEvent(`WB-to-EX forwarding: ${source} gets R${index} = ${currentWB.writeValue}`);
            return currentWB.writeValue;
        }
    }

    return registers[index];
}

function executeInstruction(inst, currentMEM, currentWB) {
    const a = getValue(inst.rs1, currentMEM, currentWB, "Operand A");

    if (inst.op === "LW" || inst.op === "SW") {
        inst.address = a + inst.offset;
        if (inst.op === "SW") {
            inst.storeValue = getValue(
                inst.rs2, currentMEM, currentWB, "Store data"
            );
        }
        return;
    }
if (inst.op === "BEQ" || inst.op === "BNE") {
    const b = getValue(
        inst.rs2, currentMEM, currentWB, "Branch operand B"
    );

    const equal = a === b;

    inst.branchTaken =
        inst.op === "BEQ" ? equal : !equal;

    return;
}
    const b = inst.op === "ADDI"
        ? inst.immediate
        : getValue(inst.rs2, currentMEM, currentWB, "Operand B");

    switch (inst.op) {
        case "ADD":
        case "ADDI":
            inst.aluResult = a + b;
            break;
        case "SUB":
            inst.aluResult = a - b;
            break;
        case "AND":
            inst.aluResult = a & b;
            break;
        case "OR":
            inst.aluResult = a | b;
            break;
        case "XOR":
            inst.aluResult = a ^ b;
            break;
    }

    inst.aluResult = inst.aluResult >>> 0;
}

function memoryAccess(inst) {
    if (!inst) return;

    if (inst.op === "LW") {
        if (inst.address < 0 || inst.address >= memory.length) {
            throw new Error("Memory address out of range: " + inst.address);
        }

        inst.loadedValue = memory[inst.address];
        inst.writeValue = inst.loadedValue;

        logEvent(`Memory read: M[${inst.address}] = ${inst.loadedValue}`);
    }

    if (inst.op === "SW") {
        if (inst.address < 0 || inst.address >= memory.length) {
            throw new Error("Memory address out of range: " + inst.address);
        }

        memory[inst.address] = inst.storeValue >>> 0;

        logEvent(`Memory write: M[${inst.address}] = ${memory[inst.address]}`);
    }

    if (["ADD", "ADDI", "SUB", "AND", "OR", "XOR"].includes(inst.op)) {
        inst.writeValue = inst.aluResult;
    }
}

function writeBack(inst) {
    if (!inst) return;

    completedInstructions++;

    if (inst.rd !== undefined && inst.rd !== 0) {
        if (inst.writeValue !== undefined) {
            registers[inst.rd] = inst.writeValue;
            logEvent(`Write-back: R${inst.rd} = ${inst.writeValue}`);
        }
    }

    registers[0] = 0;
}


function step() {
    if (finished) return;

    try {
        cycle++;

        const old = pipeline.slice();

        // 1. Write-back
        writeBack(old[4]);

        // 2. Memory stage
        memoryAccess(old[3]);

        // 3. Detect load-use hazard
        const loadInEX = old[2] && old[2].op === "LW";
        const consumerInID = old[1];

        const stall = !!(
            loadInEX &&
            consumerInID &&
            usesRegister(consumerInID, old[2].rd)
        );

        // 4. Execute instruction
        if (old[2]) {
            executeInstruction(old[2], old[3], old[4]);

           
// 5. Handle a taken branch
if (old[2].branchTaken) {
    const targetPC =
        old[2].index + 1 + old[2].offset;

    if (targetPC < 0 || targetPC >= instructions.length) {
        throw new Error("Branch target is outside the program.");
    }

    // Count the taken branch exactly once
    completedInstructions++;
    logEvent(`Instruction executed: ${old[2].text}`);

    pc = targetPC;

    console.log("Branch debug:", {
        branch: old[2].text,
        IF: old[0]?.text,
        ID: old[1]?.text,
        EX: old[2]?.text,
        MEM: old[3]?.text,
        WB: old[4]?.text
    });

    pipeline = [null, null, null, null, old[3]];

    logEvent(
        `${old[2].op} taken: jumping to instruction ${targetPC + 1}.`
    );

    updateMonitor(
        "Branch taken.",
        `Program counter redirected to instruction ${targetPC + 1}.`
    );

    updateDisplay();

    document.getElementById("status").textContent =
        "Branch taken. Pipeline redirected.";

    return;
}
        }
        // 6. Advance pipeline or insert bubble
        const nextWB = old[3];
        const nextMEM = old[2];

        if (stall) {
            stallCount++;

            pipeline = [
                old[0],
                old[1],
                null,
                nextMEM,
                nextWB
            ];

            updateMonitor(
                `Load-use hazard: ${consumerInID.text} needs R${old[2].rd}.`,
                "Pipeline stalled for one cycle."
            );

            logEvent("Load-use hazard detected: inserted one-cycle bubble.");
        } else {
            const nextIF = pc < instructions.length
                ? { ...instructions[pc], index: pc++ }
                : null;

            pipeline = [
                nextIF,
                old[0],
                old[1],
                nextMEM,
                nextWB
            ];

            updateMonitor(
                "No load-use hazard this cycle.",
                "Forwarding occurs when a dependency requires it."
            );
        }

        updateDisplay();

        const active = pipeline.some(Boolean);
        const more = pc < instructions.length;

        if (!active && !more) {
            finished = true;
            stopRunning();

            document.getElementById("status").textContent =
                "Execution completed successfully!";
        } else {
            document.getElementById("status").textContent =
                "Processor executing instructions...";
        }

    } catch (error) {
        stopRunning();
        document.getElementById("status").textContent =
            "Error: " + error.message;
    }
}


function updateDisplay() {
    document.getElementById("cycle").textContent = "Cycle: " + cycle;

    stages.forEach((name, index) => {
        const element = document.getElementById(name);
        const inst = pipeline[index];

       element.classList.remove("active");

if (inst) {
    void element.offsetWidth;
    element.classList.add("active");
}
        element.textContent = inst ? name + "\n" + inst.text : name;
        element.title = inst ? inst.text : "Empty";
    });

    const registerContainer = document.getElementById("registers");
    registerContainer.innerHTML = "";

    registers.forEach((value, index) => {
        const item = document.createElement("div");
        item.className = "register";
        item.innerHTML = `<span>R${index}</span><div>${value}</div>`;
        registerContainer.appendChild(item);
    });

    const memoryContainer = document.getElementById("memory");
    memoryContainer.innerHTML = "";

    memory.slice(0, 16).forEach((value, index) => {
        const item = document.createElement("div");
        item.className = "memory-cell";
        item.innerHTML = `<span>M[${index}]</span><strong>${value}</strong>`;
        memoryContainer.appendChild(item);
    });
  updatePerformance();  
}

function stopRunning() {
    running = false;

    if (runTimer !== null) {
        clearInterval(runTimer);
        runTimer = null;
    }

    document.getElementById("runBtn").textContent = "▶ Run";
}

function startRunning() {
    if (running) {
        stopRunning();
        return;
    }

    if (finished) {
        try {
            loadProgram();
        } catch {
            return;
        }
    }

    running = true;
    document.getElementById("runBtn").textContent = "⏸ Pause";
    runTimer = setInterval(step, 800);
}

document.getElementById("runBtn").addEventListener("click", startRunning);

document.getElementById("stepBtn").addEventListener("click", () => {
    if (finished) {
        try {
            loadProgram();
        } catch {
            return;
        }
    }
    step();
});

document.getElementById("resetBtn").addEventListener("click", () => {
    try {
        loadProgram();
    } catch {
        return;
    }
});

try {
    loadProgram();
} catch (error) {
    console.error(error);
}
