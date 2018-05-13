import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Disasm from './CPU/Disasm';
import DisasmButtons from './CPU/DisasmButtons';
import GotoBox from './CPU/GotoBox';
import LeftPanel from './CPU/LeftPanel';
import listeners from '../utils/listeners.js';
import './CPU.css';

class CPU extends PureComponent {
	state = {
		stepping: false,
		paused: true,
		started: false,
		pc: 0,
		// Note: these are inclusive.
		selectionTop: null,
		selectionBottom: null,
		jumpMarker: null,
		promptGotoMarker: null,
		lastTicks: 0,
		ticks: 0,
		currentThread: undefined,
	};
	listeners_;

	render() {
		const { paused, stepping, started, currentThread } = this.state;
		const commonProps = { stepping: stepping && !paused, paused, started, currentThread };
		const { selectionTop, selectionBottom, jumpMarker, pc } = this.state;
		const disasmProps = { ...commonProps, selectionTop, selectionBottom, jumpMarker, pc };

		return (
			<div id="CPU">
				<div className="CPU__pane">
					<GotoBox ppsspp={this.props.ppsspp} {...commonProps} gotoDisasm={this.gotoDisasm} promptGotoMarker={this.state.promptGotoMarker} />
					<LeftPanel {...this.props} {...commonProps} gotoDisasm={this.gotoDisasm} />
				</div>
				<div className="Disasm__container">
					<DisasmButtons {...this.props} {...commonProps} updateCurrentThread={this.updateCurrentThread} />
					<Disasm {...this.props} {...disasmProps} updateSelection={this.updateSelection} promptGoto={this.promptGoto} />
				</div>
			</div>
		);
	}

	componentDidMount() {
		this.listeners_ = listeners.listen({
			'connection': () => this.onConnection(),
			'connection.change': (connected) => this.onConnectionChange(connected),
			'cpu.stepping': (data) => this.onStepping(data),
			'cpu.resume': () => this.setState({ stepping: false }),
			'game.start': () => this.setState({ started: true, paused: false }),
			'game.quit': () => this.setState({ started: false, stepping: false, paused: true, pc: 0, currentThread: undefined }),
			'game.pause': () => this.setState({ paused: true }),
			'game.resume': () => this.setState({ paused: false }),
			'cpu.setReg': (result) => {
				if (result.category === 0 && result.register === 32) {
					this.setState({ pc: result.uintValue });
				}
			},
		});
	}

	componentWillUnmount() {
		listeners.forget(this.listeners_);
	}

	onConnectionChange(connected) {
		// On any reconnect, assume paused until proven otherwise.
		this.setState({ connected, started: false, stepping: false, paused: true });
		if (!connected) {
			this.setState({ currentThread: undefined });
		}
	}

	onConnection() {
		// Update the status of this connection immediately too.
		this.props.ppsspp.send({ event: 'cpu.status' }).then((result) => {
			const { stepping, paused, pc, ticks } = result;
			const started = pc !== 0 || stepping;
			this.setState({ connected: true, started, stepping, paused, pc, ticks, lastTicks: ticks });
		}, (err) => {
			this.setState({ stepping: false, paused: true });
		});
	}

	onStepping(data) {
		this.setState({
			stepping: true,
			pc: data.pc,
			selectionTop: data.pc,
			selectionBottom: data.pc,
			lastTicks: this.state.ticks,
			ticks: data.ticks,
		});
	}

	updateSelection = (data) => {
		this.setState(data);
	}

	gotoDisasm = (pc) => {
		this.setState({
			selectionTop: pc,
			selectionBottom: pc,
			// It just matters that this is a new object.
			jumpMarker: {},
		});
	}

	promptGoto = () => {
		this.setState({
			promptGotoMarker: {},
		});
	}

	updateCurrentThread = (currentThread, pc) => {
		this.setState({ currentThread });
		if (pc) {
			this.gotoDisasm(pc);
		}
	}
}

CPU.propTypes = {
	ppsspp: PropTypes.object.isRequired,
	log: PropTypes.func.isRequired,
};

export default CPU;
