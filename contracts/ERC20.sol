pragma solidity ^0.8;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract C is ERC20 {
    constructor(uint256 initialSupply) ERC20("Gold", "GLD") {
        _mint(msg.sender, initialSupply);
    }
}
