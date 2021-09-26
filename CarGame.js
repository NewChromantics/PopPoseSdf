import {DegToRad,Add3,Multiply3,Length3,GetRayRayIntersection3,Clamp01} from './PopEngine/Math.js'
import {CreatePromise,Yield} from './TinyWebgl.js'


class Track_t
{
	constructor()
	{
		this.Points = [
		[0,0],
		[4,0],
		[4,2],
		[3,4],
		[-2,4],
		];
	}
}


const Colours = [
[182, 224, 43],
[237,103,62]
];

const TurnAnglesPerMetre = 150;
const MaxWheelAngle = 45;
const FrictionPerSec = 1.0;
const AccellForce = 0.3;	//	need to turn this into a throttle

class Car_t
{
	constructor(CarIndex)
	{
		this.Colour = Colours[CarIndex].map(f=>f/255);
		this.Position = [0,0,0];
		
		this.BodyAngleDegrees = 0;
		this.WheelAngleDegrees = 0;
		this.Position[0] += CarIndex * 0.5;
		this.Velocity = [0,0,0];
	}
	
	get BodyAngleRadians()
	{
		return DegToRad(this.BodyAngleDegrees);
	}
	get WheelAngleRadians()
	{
		return DegToRad(this.WheelAngleDegrees);
	}
	
	get SpeedNormal()
	{
		let MaxSpeed = 0.1;
		let Speed = Length3(this.Velocity);
		return Speed/MaxSpeed;
	}
	
	Iteration(TimeDelta,InputTurn,InputPower=0)
	{
		//	add force in the direction of the rear wheels (body angle)
		let Forward = [ Math.sin(this.BodyAngleRadians), 0, Math.cos(this.BodyAngleRadians) ];
		InputPower *= AccellForce;
		let FowardPower = Multiply3(Forward,[InputPower,InputPower,InputPower]);
		FowardPower = Multiply3(FowardPower,[TimeDelta,TimeDelta,TimeDelta]);
		this.Velocity = Add3( this.Velocity,FowardPower);
		
		//	instead of damping, we apply a reverse force for friction
		const Friction = 4.9;
		let FrictionForce = Multiply3( this.Velocity, [-Friction,-Friction,-Friction] );
		FrictionForce = Multiply3( FrictionForce, [TimeDelta,TimeDelta,TimeDelta] );
		this.Velocity = Add3( this.Velocity, FrictionForce );
		
		let Movement = this.Velocity.slice();
		let MovementLength = Length3(Movement) * TimeDelta;
		this.Position = Add3( this.Position, Movement );
		
		this.WheelAngleDegrees = MaxWheelAngle * InputTurn;
		
		//	gr: this should only turns as we move 
		this.BodyAngleDegrees += this.WheelAngleDegrees * MovementLength * TurnAnglesPerMetre;
	}
}

export default class Game_t
{
	constructor()
	{
		this.MouseUv = [0.5,0.5];
		this.MouseButtonsDown = {};	//	key=button value=uv
		this.WorldLightPosition = [1.9,1.4,1.8];
		
		this.Event_Finished = CreatePromise();
		
		this.Track = new Track_t();
		this.Cars = [ new Car_t(0), new Car_t(1) ];
	}
	
	async GameLoop()
	{
		await this.Event_Finished;
		return `Game over`;
	}
	
	Iteration(TimeDelta,InputRays)
	{
		let ControlledCar = 0;
		for ( let c=0;	c<this.Cars.length;	c++ )
		{
			const Car = this.Cars[c];
			let Turn = 0;
			let Power = 0;
			if ( ControlledCar == c )
			{
				const Left = InputRays.hasOwnProperty('Left') ? -1 : 0;
				const Right = InputRays.hasOwnProperty('Right') ? 1 : 0;
				Turn = Left + Right;
				Power = InputRays.hasOwnProperty('Middle') ? 1 : 0;
			}
			else
			{
				//	ai
			}
			
			Car.Iteration( TimeDelta, Turn, Power );
		}
	}
	
	GetUniforms()
	{
		const Uniforms = Object.assign({},this);
		Uniforms.CarPositions = this.Cars.map( c => c.Position ).flat();
		Uniforms.CarColours = this.Cars.map( c => c.Colour ).flat();
		Uniforms.CarAngles = this.Cars.map( c => c.BodyAngleDegrees );
		
		Uniforms.TrackPoints = this.Track.Points.flat();
		
		return Uniforms;
	}
}
