// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC20Transfer {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title SqueekNames
/// @notice Onchain nicknames, likes and SQK tips for Squeek NFTs.
/// @dev No owner, no fee, no upgrade path. The NFT and SQK addresses are fixed at deployment.
///      A tip moves SQK straight from the tipper to the Squeek's current holder; this contract
///      never holds tokens. Likes belong to a name: renaming starts the new name at zero likes.
contract SqueekNames {
    uint256 public constant MAX_NAME_BYTES = 20;
    /// @dev Weeks start Monday 00:00 UTC (the Unix epoch was a Thursday).
    uint256 public constant WEEK_OFFSET = 3 days;

    IERC721Owner public immutable squeeks;
    IERC20Transfer public immutable sqk;

    struct Entry {
        uint256 tokenId;
        string name;
        address namedBy;
        uint64 namedAt;
        uint32 version;
        uint256 likes;
        uint256 weekLikes;
        uint256 tipped;
    }

    mapping(uint256 => Entry) private _entries;
    mapping(uint256 => mapping(uint32 => mapping(address => bool))) public hasLiked;
    mapping(uint256 => mapping(uint256 => mapping(uint32 => uint256))) private _weekLikes;
    uint256[] private _named;

    event Named(uint256 indexed tokenId, address indexed by, string name, uint32 version);
    event Liked(uint256 indexed tokenId, address indexed by, uint32 version, uint256 likes, uint256 week);
    event Tipped(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount);

    error NotHolder(uint256 tokenId);
    error InvalidName();
    error Unnamed(uint256 tokenId);
    error AlreadyLiked(uint256 tokenId);
    error OwnLike(uint256 tokenId);
    error ZeroAmount();
    error TipFailed();

    constructor(address squeekNft, address sqkToken) {
        require(squeekNft != address(0) && sqkToken != address(0), "zero address");
        squeeks = IERC721Owner(squeekNft);
        sqk = IERC20Transfer(sqkToken);
    }

    function currentWeek() public view returns (uint256) {
        return (block.timestamp + WEEK_OFFSET) / 1 weeks;
    }

    /// @notice Name a Squeek you hold: 1-20 characters of A-Z, a-z, 0-9, space or hyphen.
    function setName(uint256 tokenId, string calldata name) external {
        if (squeeks.ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId);
        if (!validName(name)) revert InvalidName();
        Entry storage e = _entries[tokenId];
        if (e.version == 0) {
            e.tokenId = tokenId;
            _named.push(tokenId);
        }
        e.version += 1;
        e.name = name;
        e.namedBy = msg.sender;
        e.namedAt = uint64(block.timestamp);
        e.likes = 0;
        emit Named(tokenId, msg.sender, name, e.version);
    }

    /// @notice Like the current name of a Squeek. One like per address per name; holders cannot like their own.
    function like(uint256 tokenId) external {
        Entry storage e = _entries[tokenId];
        if (e.version == 0) revert Unnamed(tokenId);
        if (squeeks.ownerOf(tokenId) == msg.sender) revert OwnLike(tokenId);
        if (hasLiked[tokenId][e.version][msg.sender]) revert AlreadyLiked(tokenId);
        hasLiked[tokenId][e.version][msg.sender] = true;
        e.likes += 1;
        uint256 week = currentWeek();
        _weekLikes[week][tokenId][e.version] += 1;
        emit Liked(tokenId, msg.sender, e.version, e.likes, week);
    }

    /// @notice Tip SQK to the current holder of a named Squeek. Approve this contract for `amount` first.
    function tip(uint256 tokenId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Entry storage e = _entries[tokenId];
        if (e.version == 0) revert Unnamed(tokenId);
        address to = squeeks.ownerOf(tokenId);
        if (!sqk.transferFrom(msg.sender, to, amount)) revert TipFailed();
        e.tipped += amount;
        emit Tipped(tokenId, msg.sender, to, amount);
    }

    function namedCount() external view returns (uint256) {
        return _named.length;
    }

    /// @notice One named Squeek, with the likes its current name got in `week`.
    function entryOf(uint256 tokenId, uint256 week) public view returns (Entry memory e) {
        e = _entries[tokenId];
        e.tokenId = tokenId;
        if (e.version != 0) e.weekLikes = _weekLikes[week][tokenId][e.version];
    }

    /// @notice A page of named Squeeks in naming order, for listings and the weekly board.
    function entries(uint256 offset, uint256 limit, uint256 week) external view returns (Entry[] memory page) {
        uint256 n = _named.length;
        if (offset >= n) return new Entry[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        page = new Entry[](end - offset);
        for (uint256 i = offset; i < end; i++) page[i - offset] = entryOf(_named[i], week);
    }

    function validName(string calldata name) public pure returns (bool) {
        bytes calldata b = bytes(name);
        if (b.length == 0 || b.length > MAX_NAME_BYTES) return false;
        if (b[0] == 0x20 || b[b.length - 1] == 0x20) return false;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) || (c >= 0x30 && c <= 0x39)
                || c == 0x20 || c == 0x2D;
            if (!ok) return false;
        }
        return true;
    }
}
