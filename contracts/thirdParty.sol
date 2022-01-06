pragma solidity ^0.8;

interface ERC20Token {
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external;
}

contract C {
    function spendToken(address _tokenAddr, address _owner, address _recipient, uint256 amount) public {
        ERC20Token tok = ERC20Token(_tokenAddr);
        tok.transferFrom(_owner, _recipient, amount);
    }
}
